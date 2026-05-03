# MQTT client for Django battery monitoring
import json
from datetime import datetime
import paho.mqtt.client as mqtt
from django.utils import timezone
from .models import BatteryStation, BatteryReading, BatteryAlert

# Normalize SOC/SOH if coming in deci-percent (e.g., 763 => 76.3%)
def normalize_percent(x: int) -> int:
    try:
        xi = int(x)
    except Exception:
        return 0
    if xi > 1000:
        # unlikely, clamp
        return min(round(xi / 100), 100)
    if xi > 100:
        return min(round(xi / 10), 100)
    return xi

class MQTTClient:
    def __init__(self, broker: str, port: int, username: str = "", password: str = ""):
        self.client = mqtt.Client()
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            # Prefer topic station if encoded as /batteries/<station_id>/data
            topic_parts = msg.topic.strip('/').split('/') if msg.topic else []
            topic_station = topic_parts[1] if len(topic_parts) >= 3 else None
            station_id = payload.get('station_id') or topic_station
            ts_str = payload.get('timestamp')
            # Accept ISO or compact: 20251103T13:15:00
            try:
                ts = datetime.fromisoformat(ts_str)
            except Exception:
                ts = datetime.strptime(ts_str, "%Y%m%dT%H:%M:%S") if ts_str else timezone.now()
            if not station_id:
                return
            try:
                station = BatteryStation.objects.get(station_id=station_id)
            except BatteryStation.DoesNotExist:
                return

            for b in payload.get('batteries', []):
                soc = normalize_percent(b.get('SOC', 0))
                soh = normalize_percent(b.get('SOH', 0))
                reading = BatteryReading.objects.create(
                    station=station,
                    battery_id=b['battery_id'],
                    voltage=int(b['V']),
                    temperature=int(b['T']),
                    soc=soc,
                    soh=soh,
                    imp=int(b['IMP']),
                    timestamp=ts,
                )
                self.check_battery_alerts(station, b, reading)
        except Exception as e:
            print(f"Error processing MQTT message: {e}")

    def check_battery_alerts(self, station: BatteryStation, b: dict, reading: BatteryReading):
        voltage = int(b.get('V', 0))
        temperature = int(b.get('T', 0))
        soc = normalize_percent(b.get('SOC', 0))
        soh = normalize_percent(b.get('SOH', 0))

        alerts = []
        severity = None

        if voltage < station.voltage_min or voltage > station.voltage_max:
            alerts.append(f"Voltage out of range: {voltage/1000:.2f}V")
            severity = 'critical'
        if temperature < station.temperature_min or temperature > station.temperature_max:
            alerts.append(f"Temperature out of range: {temperature/10:.1f}°C")
            severity = 'critical'
        if soc < station.soc_min:
            alerts.append(f"Low charge: {soc}%")
            severity = severity or 'warning'
        if soh < station.soh_min:
            alerts.append(f"Low health: {soh}%")
            severity = severity or 'warning'

        if alerts:
            BatteryAlert.objects.create(
                station=station,
                battery_id=b.get('battery_id', ''),
                severity=severity or 'info',
                message=" | ".join(alerts),
                voltage=voltage,
                temperature=temperature,
                soc=soc,
                soh=soh,
                imp=int(b.get('IMP', 0)),
                alert_time=reading.timestamp,
            )

    def connect_and_subscribe(self, topic: str):
        self.client.on_message = self.on_message
        if self.username or self.password:
            self.client.username_pw_set(self.username, self.password)
        self.client.connect(self.broker, self.port, 60)
        self.client.subscribe(topic)
        self.client.loop_start()
