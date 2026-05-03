import json
import logging
import os
import time
import threading
from datetime import datetime
import paho.mqtt.client as mqtt
from django.db import IntegrityError
from django.utils import timezone
from .models import BatteryStation, BatteryReading, BatteryAlert
from .notifications import dispatch_alert_notifications

logger = logging.getLogger('batteries.mqtt')

DEBUG = os.getenv("MQTT_DEBUG", "0") in {"1", "true", "TRUE", "yes", "YES"}
MIN_VALID_TIMESTAMP_YEAR = int(os.getenv("MQTT_MIN_VALID_TIMESTAMP_YEAR", "2000"))

# Normalize SOC/SOH if coming in deci-percent (e.g., 763 => 76.3%)

def normalize_percent(x: int) -> int:
    try:
        xi = int(x)
    except Exception:
        return 0
    if xi > 1000:
        return min(round(xi / 100), 100)
    if xi > 100:
        return min(round(xi / 10), 100)
    return xi


def _coerce_int(value, default=None):
    try:
        return int(value)
    except Exception:
        return default


def _parse_payload_timestamp(ts_str):
    """Parse an MQTT payload timestamp and reject obviously bogus values.

    Some device payloads report elapsed time or bad RTC values like 1970-01-01.
    Those timestamps make the dashboard look stale, so we fall back to the
    backend receive time for anything earlier than the configured minimum year.
    """

    fallback = timezone.now()
    if not ts_str:
        return fallback

    parsed = None
    try:
        parsed = datetime.fromisoformat(ts_str)
    except Exception:
        try:
            parsed = datetime.strptime(ts_str, "%Y%m%dT%H:%M:%S")
        except Exception:
            return fallback

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    if parsed.year < MIN_VALID_TIMESTAMP_YEAR:
        return fallback

    return parsed


class MQTTClient:
    """MQTT client with automatic reconnection and exponential backoff."""

    BACKOFF_MIN = 1      # seconds
    BACKOFF_MAX = 60      # seconds
    BACKOFF_FACTOR = 2

    def __init__(self, broker: str, port: int, username: str = "", password: str = "",
                 station_id: str = ""):
        self.client = mqtt.Client()
        # Strip protocol prefixes (mqtt://, mqtts://, tcp://) — paho needs bare hostname
        clean_broker = broker.strip()
        for prefix in ('mqtts://', 'mqtt://', 'tcp://'):
            if clean_broker.lower().startswith(prefix):
                clean_broker = clean_broker[len(prefix):]
                break
        self.broker = clean_broker.rstrip('/')
        self.port = port
        self.username = username
        self.password = password
        self.station_id = station_id
        self._topic: str = ""
        self._backoff = self.BACKOFF_MIN
        self._running = True
        self._connected = False

        # Wire up callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self.on_message

    # ── Connection lifecycle callbacks ─────────────────────────────────────

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            self._backoff = self.BACKOFF_MIN  # reset backoff on successful connect
            logger.info("[MQTT:%s] Connected to %s:%s", self.station_id, self.broker, self.port)
            if self._topic:
                client.subscribe(self._topic)
                logger.info("[MQTT:%s] Subscribed to %s", self.station_id, self._topic)
        else:
            logger.warning("[MQTT:%s] Connection refused, rc=%s", self.station_id, rc)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            logger.warning("[MQTT:%s] Unexpected disconnect (rc=%s). Will auto-reconnect...",
                           self.station_id, rc)
            self._start_reconnect_loop()

    def _start_reconnect_loop(self):
        """Spawn a reconnection thread with exponential backoff."""
        def _reconnect():
            while self._running and not self._connected:
                wait = self._backoff
                logger.info("[MQTT:%s] Reconnecting in %ss...", self.station_id, wait)
                time.sleep(wait)
                self._backoff = min(self._backoff * self.BACKOFF_FACTOR, self.BACKOFF_MAX)
                try:
                    self.client.reconnect()
                    break  # loop_start will fire _on_connect
                except Exception as e:
                    logger.error("[MQTT:%s] Reconnect failed: %s", self.station_id, e)

        t = threading.Thread(target=_reconnect, daemon=True)
        t.start()

    # ── Message handling ───────────────────────────────────────────────────

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            if DEBUG:
                logger.debug("[MQTT:%s] Received on %s: %s",
                             self.station_id, msg.topic, json.dumps(payload, indent=2))
            
            # Always route data to THIS client's station (the one configured in DB),
            # regardless of what station_id the payload contains.
            station_id = self.station_id or payload.get('station_id') or payload.get('stationId') or ""
            ts_str = payload.get('timestamp') or payload.get('time') or payload.get('created_at')
            ts = _parse_payload_timestamp(ts_str)
            if ts_str and ts.year >= MIN_VALID_TIMESTAMP_YEAR and DEBUG:
                logger.debug("[MQTT:%s] Parsed payload timestamp %s", self.station_id, ts)
            elif ts_str:
                logger.warning("[MQTT:%s] Replaced invalid payload timestamp %r with receive time %s",
                               self.station_id, ts_str, ts.isoformat())
            if not station_id:
                logger.warning("[MQTT:%s] Dropping message: no station_id configured",
                               self.station_id)
                return
            try:
                station = BatteryStation.objects.get(station_id=station_id)
            except BatteryStation.DoesNotExist:
                logger.warning("[MQTT:%s] Station not found: %s. Create it first via admin or API.",
                               self.station_id, station_id)
                return

            batteries = payload.get('batteries', [])
            if not isinstance(batteries, list):
                logger.warning("[MQTT:%s] Dropping message: batteries field is not a list", self.station_id)
                return

            valid_battery_count = 0
            for idx, b in enumerate(batteries):
                if not isinstance(b, dict):
                    logger.warning("[MQTT:%s] Skipping battery[%s]: not an object", self.station_id, idx)
                    continue

                battery_id = b.get('battery_id') or b.get('batteryId')
                if not battery_id:
                    logger.warning("[MQTT:%s] Skipping battery[%s]: missing battery_id", self.station_id, idx)
                    continue

                voltage = _coerce_int(b.get('V', b.get('voltage')))
                temperature = _coerce_int(b.get('T', b.get('temperature')))
                impedance = _coerce_int(b.get('IMP', b.get('imp')))
                if voltage is None or temperature is None or impedance is None:
                    logger.warning(
                        "[MQTT:%s] Skipping %s: invalid numeric field(s) V=%r T=%r IMP=%r",
                        self.station_id,
                        battery_id,
                        b.get('V', b.get('voltage')),
                        b.get('T', b.get('temperature')),
                        b.get('IMP', b.get('imp')),
                    )
                    continue

                soc = normalize_percent(b.get('SOC', b.get('soc', 0)))
                soh = normalize_percent(b.get('SOH', b.get('soh', 0)))

                # Deduplicate: skip if an identical reading already exists
                # (guards against QoS retries and duplicate MQTT publishes)
                try:
                    reading, created = BatteryReading.objects.get_or_create(
                        station=station,
                        battery_id=battery_id,
                        timestamp=ts,
                        defaults={
                            'voltage': voltage,
                            'temperature': temperature,
                            'soc': soc,
                            'soh': soh,
                            'imp': impedance,
                        },
                    )
                except IntegrityError:
                    # Race condition: another thread inserted the same reading
                    if DEBUG:
                        logger.debug("[MQTT:%s] Race-condition duplicate skipped: %s/%s @ %s",
                                     self.station_id, station_id, battery_id, ts)
                    continue

                if not created:
                    if DEBUG:
                        logger.debug("[MQTT:%s] Duplicate reading skipped: %s/%s @ %s",
                                     self.station_id, station_id, battery_id, ts)
                    continue

                self.check_battery_alerts(
                    station,
                    {
                        'battery_id': battery_id,
                        'V': voltage,
                        'T': temperature,
                        'SOC': soc,
                        'SOH': soh,
                        'IMP': impedance,
                    },
                    reading,
                )
                valid_battery_count += 1
                if DEBUG:
                    logger.debug("[MQTT:%s] Ingested %s/%s @ %s V=%smV T=%s SOC=%s%% SOH=%s%% IMP=%s",
                                 self.station_id, station_id, battery_id, ts,
                                 voltage, temperature, soc, soh, impedance)

            if DEBUG and valid_battery_count == 0:
                logger.debug("[MQTT:%s] No valid battery records found in payload from %s", self.station_id, msg.topic)
        except Exception as e:
            logger.error("[MQTT:%s] Error processing message: %s", self.station_id, e, exc_info=True)

    def check_battery_alerts(self, station: BatteryStation, b: dict, reading: BatteryReading):
        """
        Mirror the frontend's precise threshold logic with deltas and nuanced severity.
        Units:
          - voltage: mV
          - temperature: 0.1°C
          - soc/soh: percent (0-100)
          - imp: ohms
        Station thresholds are stored as:
          - voltage_min/max: mV
          - temperature_min/max: 0.1°C
          - soc_min, soh_min: %
        Optional impedance max can be provided via:
          - station.imp_max (if added later), or
          - env IMP_MAX_DEFAULT (ohms)
        """

        voltage_mv = int(b.get('V', 0))
        temperature_ddec = int(b.get('T', 0))
        soc = normalize_percent(b.get('SOC', 0))
        soh = normalize_percent(b.get('SOH', 0))
        imp_mohm = int(b.get('IMP', 0))

        v = voltage_mv / 1000.0
        t = temperature_ddec / 10.0
        vmin = (station.voltage_min or 0) / 1000.0
        vmax = (station.voltage_max or 0) / 1000.0
        tmin = (station.temperature_min or 0) / 10.0
        tmax = (station.temperature_max or 0) / 10.0
        soc_min = station.soc_min or 0
        soh_min = station.soh_min or 0

        # Optional impedance threshold
        station_imp_max = getattr(station, 'imp_max', None)
        if station_imp_max is None:
            try:
                station_imp_max = int(os.getenv('IMP_MAX_DEFAULT', '0')) or None
            except Exception:
                station_imp_max = None

        issues = []  # (severity, message)

        # Voltage
        if vmin and v < vmin:
            delta = round(vmin - v, 2)
            sev = 'critical' if delta >= 0.2 else 'warning'
            issues.append((sev, f"Voltage {v:.2f}V below min {vmin:.2f}V (Δ -{delta:.2f}V)"))
        elif vmax and v > vmax:
            delta = round(v - vmax, 2)
            sev = 'critical' if delta >= 0.2 else 'warning'
            issues.append((sev, f"Voltage {v:.2f}V above max {vmax:.2f}V (Δ +{delta:.2f}V)"))

        # Temperature
        if tmin and t < tmin:
            delta = round(tmin - t, 1)
            sev = 'critical' if delta >= 5.0 else 'warning'
            issues.append((sev, f"Temperature {t:.1f}°C below min {tmin:.1f}°C (Δ -{delta:.1f}°C)"))
        elif tmax and t > tmax:
            delta = round(t - tmax, 1)
            sev = 'critical' if delta >= 5.0 else 'warning'
            issues.append((sev, f"Temperature {t:.1f}°C above max {tmax:.1f}°C (Δ +{delta:.1f}°C)"))

        # SOC
        if soc_min and soc < soc_min:
            delta = soc_min - soc
            sev = 'critical' if delta >= 15 else 'warning'
            issues.append((sev, f"SOC {soc}% below min {soc_min}% (Δ -{delta}%)"))

        # SOH
        if soh_min and soh < soh_min:
            delta = soh_min - soh
            sev = 'critical' if delta >= 20 else 'warning'
            issues.append((sev, f"Health {soh}% below min {soh_min}% (Δ -{delta}%)"))

        # Impedance (optional)
        if station_imp_max is not None and imp_mohm > station_imp_max:
            delta_mohm = imp_mohm - station_imp_max
            sev = 'critical' if delta_mohm >= 50 else 'warning'
            imp_ohm_val = imp_mohm / 1000.0
            station_imp_max_ohm = station_imp_max / 1000.0
            delta_ohm = delta_mohm / 1000.0
            issues.append((sev, f"Impedance {imp_ohm_val:.3f}Ω above max {station_imp_max_ohm:.3f}Ω (Δ +{delta_ohm:.3f}Ω)"))

        if issues:
            overall = 'critical' if any(sev == 'critical' for sev, _ in issues) else 'warning'
            message = " | ".join(msg for _, msg in issues)

            # Deduplicate: skip if an alert already exists for this battery at this timestamp
            existing = BatteryAlert.objects.filter(
                station=station,
                battery_id=b.get('battery_id', ''),
                alert_time=reading.timestamp,
            ).exists()
            if existing:
                if DEBUG:
                    logger.debug("[MQTT:%s] Duplicate alert skipped for %s/%s @ %s",
                                 self.station_id, station.station_id,
                                 b.get('battery_id', ''), reading.timestamp)
                return

            alert = BatteryAlert.objects.create(
                station=station,
                battery_id=b.get('battery_id', ''),
                severity=overall,
                message=message,
                voltage=voltage_mv,
                temperature=temperature_ddec,
                soc=soc,
                soh=soh,
                imp=imp_mohm,
                alert_time=reading.timestamp,
            )
            try:
                dispatch_alert_notifications(alert)
            except Exception as notify_error:
                logger.error("[MQTT:%s] Notification dispatch failed: %s", self.station_id, notify_error, exc_info=True)

    # ── Public API ─────────────────────────────────────────────────────────

    def connect_and_subscribe(self, topic: str):
        self._topic = topic
        if self.username or self.password:
            logger.info("[MQTT:%s] Setting authentication — user: %s", self.station_id, self.username)
            self.client.username_pw_set(self.username, self.password)
        
        logger.info("[MQTT:%s] Connecting to %s:%s...", self.station_id, self.broker, self.port)
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            if DEBUG:
                logger.debug("[MQTT:%s] Subscribed to %s on %s:%s",
                             self.station_id, topic, self.broker, self.port)
        except Exception as e:
            logger.error("[MQTT:%s] Initial connection failed: %s — will auto-reconnect",
                         self.station_id, e)
            self._start_reconnect_loop()

    def stop(self):
        """Gracefully stop the client."""
        self._running = False
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception:
            pass
