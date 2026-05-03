import csv
import io
import importlib
import hashlib
import logging
from collections import defaultdict
from datetime import date as date_cls
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives, get_connection
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from .models import BatteryAlert, BatteryReading, BatteryStation, GlobalNotificationSettings, NotificationDeliveryLog, StationNotificationSettings

logger = logging.getLogger('batteries.notifications')


def get_station_notification_settings(station: BatteryStation) -> StationNotificationSettings:
    settings_obj, _ = StationNotificationSettings.objects.get_or_create(station=station)
    return settings_obj


def get_global_notification_settings() -> GlobalNotificationSettings:
    settings_obj, _ = GlobalNotificationSettings.objects.get_or_create(scope='global')
    return settings_obj


def _alert_summary(alert: BatteryAlert) -> str:
    parts = [f"{alert.severity.upper()} alert for {alert.station.station_id}/{alert.battery_id}"]
    if alert.message:
        parts.append(alert.message)
    if alert.voltage is not None:
        parts.append(f"Voltage: {alert.voltage / 1000:.2f}V")
    if alert.temperature is not None:
        parts.append(f"Temperature: {alert.temperature / 10:.1f}C")
    if alert.soc is not None:
        parts.append(f"SOC: {alert.soc}%")
    if alert.soh is not None:
        parts.append(f"SOH: {alert.soh}%")
    if alert.imp is not None:
        parts.append(f"Impedance: {alert.imp} ohm")
    return " | ".join(parts)


def _send_email(subject: str, body: str, recipients: list[str], attachment: tuple[str, str] | None = None) -> None:
    if not recipients:
        raise ValueError("No email recipients configured")

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
        connection=get_connection(),
    )
    if attachment is not None:
        filename, csv_text = attachment
        email.attach(filename, csv_text.encode('utf-8'), 'text/csv')
    email.send(fail_silently=False)


def _get_twilio_client():
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        return None
    try:
        twilio_rest = importlib.import_module('twilio.rest')
    except Exception:
        logger.warning("Twilio package is not installed; SMS notifications are disabled.")
        return None
    return twilio_rest.Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def _send_sms(message: str, recipient: str) -> None:
    client = _get_twilio_client()
    if client is None:
        raise RuntimeError("Twilio is not configured")
    client.messages.create(body=message, from_=settings.TWILIO_FROM_NUMBER, to=recipient)


def _log_delivery(station: BatteryStation, channel: str, recipient: str, subject: str = '', message: str = '', provider: str = '', status: str = 'queued', error: str = ''):
    return NotificationDeliveryLog.objects.create(
        station=station,
        channel=channel,
        recipient=recipient,
        subject=subject,
        message=message,
        provider=provider,
        status=status,
        error=error,
        sent_at=timezone.now() if status == 'sent' else None,
    )


def _resolve_channel(setting_value: str, enabled: bool, fallback_value: str, fallback_enabled: bool) -> tuple[str, bool]:
    if setting_value:
        return setting_value, enabled
    return fallback_value, fallback_enabled


@transaction.atomic
def dispatch_alert_notifications(alert: BatteryAlert) -> None:
    """Keep alert creation lightweight and let the digest job handle delivery."""
    if alert.severity not in {'warning', 'critical'}:
        return

    logger.info(
        "Queued notification digest candidate for %s/%s (%s)",
        alert.station.station_id,
        alert.battery_id,
        alert.severity,
    )


def _format_digest_timestamp(value):
    return timezone.localtime(value).strftime('%d %b %Y, %I:%M %p')


def _build_digest_hash(alerts: list[BatteryAlert]) -> str:
    hasher = hashlib.sha256()
    for alert in sorted(alerts, key=lambda item: (item.station.station_id, item.battery_id, item.severity, item.created_at, item.id)):
        hasher.update(str(alert.id).encode('utf-8'))
        hasher.update(b'|')
        hasher.update(alert.station.station_id.encode('utf-8'))
        hasher.update(b'|')
        hasher.update(alert.battery_id.encode('utf-8'))
        hasher.update(b'|')
        hasher.update(alert.severity.encode('utf-8'))
        hasher.update(b'|')
        hasher.update(alert.message.encode('utf-8'))
        hasher.update(b'|')
        hasher.update(alert.created_at.isoformat().encode('utf-8'))
        hasher.update(b'\n')
    return hasher.hexdigest()


def _build_digest_groups(alerts: list[BatteryAlert]) -> tuple[dict[str, dict], int, int, int]:
    grouped: dict[str, dict] = {}
    total_count = 0
    critical_count = 0
    warning_count = 0

    for alert in alerts:
        total_count += 1
        if alert.severity == 'critical':
            critical_count += 1
        elif alert.severity == 'warning':
            warning_count += 1

        group_key = f"{alert.battery_id}|{alert.severity}|{alert.message}"
        group = grouped.get(group_key)
        if group is None:
            group = {
                'battery_id': alert.battery_id,
                'severity': alert.severity,
                'message': alert.message,
                'count': 0,
                'first_time': alert.created_at,
                'last_time': alert.created_at,
                'voltage': alert.voltage,
                'temperature': alert.temperature,
                'soc': alert.soc,
                'soh': alert.soh,
                'imp': alert.imp,
            }
            grouped[group_key] = group

        group['count'] += 1
        if alert.created_at < group['first_time']:
            group['first_time'] = alert.created_at
        if alert.created_at > group['last_time']:
            group['last_time'] = alert.created_at
        group['voltage'] = alert.voltage
        group['temperature'] = alert.temperature
        group['soc'] = alert.soc
        group['soh'] = alert.soh
        group['imp'] = alert.imp

    return grouped, total_count, critical_count, warning_count


def _group_alerts_by_station(alerts: list[BatteryAlert]) -> list[dict]:
    station_map: dict[str, dict] = {}

    for alert in alerts:
        station_key = alert.station.station_id
        station_group = station_map.get(station_key)
        if station_group is None:
            station_group = {
                'station_id': alert.station.station_id,
                'station_name': alert.station.name,
                'total_alerts': 0,
                'critical_alerts': 0,
                'warning_alerts': 0,
                'issues': [],
            }
            station_map[station_key] = station_group

        station_group['total_alerts'] += 1
        if alert.severity == 'critical':
            station_group['critical_alerts'] += 1
        elif alert.severity == 'warning':
            station_group['warning_alerts'] += 1

        station_group['issues'].append(alert)

    stations = []
    for station_group in station_map.values():
        grouped, total_alerts, critical_alerts, warning_alerts = _build_digest_groups(station_group['issues'])
        issues = sorted(
            grouped.values(),
            key=lambda entry: (0 if entry['severity'] == 'critical' else 1, -entry['count'], entry['battery_id']),
        )
        station_group['issues'] = [
            {
                **issue,
                'first_time_label': _format_digest_timestamp(issue['first_time']),
                'last_time_label': _format_digest_timestamp(issue['last_time']),
            }
            for issue in issues
        ]
        station_group['total_alerts'] = total_alerts
        station_group['critical_alerts'] = critical_alerts
        station_group['warning_alerts'] = warning_alerts
        stations.append(station_group)

    stations.sort(key=lambda item: item['station_id'])
    return stations


def _render_digest_email(context: dict) -> tuple[str, str]:
    html_body = render_to_string('batteries/notification_digest_email.html', context)
    text_lines = [
        f"G3 BMS Digest - {context['title']}",
        f"Window: {context['window_label']}",
        f"Total alerts: {context['total_alerts']} | Critical: {context['critical_alerts']} | Warning: {context['warning_alerts']}",
        "",
    ]
    for station in context['stations']:
        text_lines.append(f"{station['station_id']} - {station['station_name']}")
        text_lines.append(
            f"  Total: {station['total_alerts']} | Critical: {station['critical_alerts']} | Warning: {station['warning_alerts']}"
        )
        for item in station['issues']:
            text_lines.append(
                f"  - {item['battery_id']} [{item['severity'].upper()}] x{item['count']} | {item['message']}"
            )
        text_lines.append("")
    if not context['stations']:
        text_lines.append('No alerts in the selected window.')
    return "\n".join(text_lines), html_body


def _send_digest_email(recipient: str, subject: str, text_body: str, html_body: str) -> None:
    email = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
        connection=get_connection(),
    )
    email.attach_alternative(html_body, 'text/html')
    email.send(fail_silently=False)


def _send_digest_sms(station: BatteryStation, recipient: str, summary: str) -> None:
    _send_sms(summary[:1500], recipient)


def send_notification_digest_report(mode: str = 'hourly', hours: int | None = None, station: BatteryStation | None = None) -> dict:
    now = timezone.now()
    if mode == 'all':
        window_start = None
        window_label = 'All notifications'
    else:
        interval_hours = hours or getattr(settings, 'NOTIFICATION_DIGEST_INTERVAL_HOURS', 1)
        window_start = now - timedelta(hours=interval_hours)
        window_label = f"Last {interval_hours} hour{'s' if interval_hours != 1 else ''}"

    station_queryset = [station] if station is not None else list(BatteryStation.objects.filter(is_active=True))
    results = []
    all_alerts: list[BatteryAlert] = []

    if not station_queryset:
        return {
            'mode': mode,
            'window_label': window_label,
            'station_count': 0,
            'results': [],
            'email_sent': False,
            'sms_sent': False,
        }

    for item in station_queryset:
        alerts_queryset = BatteryAlert.objects.select_related('station').filter(station=item)
        if window_start is not None:
            alerts_queryset = alerts_queryset.filter(created_at__gte=window_start)
        alerts = list(alerts_queryset.order_by('created_at'))
        all_alerts.extend(alerts)
        results.append({
            'station_id': item.station_id,
            'alerts': len(alerts),
            'critical': sum(1 for alert in alerts if alert.severity == 'critical'),
            'warning': sum(1 for alert in alerts if alert.severity == 'warning'),
            'email_sent': False,
            'sms_sent': False,
            'skipped': len(alerts) == 0,
        })

    grouped, total_alerts, critical_alerts, warning_alerts = _build_digest_groups(all_alerts)
    issues = sorted(
        grouped.values(),
        key=lambda entry: (0 if entry['severity'] == 'critical' else 1, -entry['count'], entry['battery_id']),
    )
    stations = _group_alerts_by_station(all_alerts)

    global_settings = get_global_notification_settings()
    digest_hash = _build_digest_hash(all_alerts)
    digest_mode = 'all' if mode == 'all' else 'hourly'
    last_hash_field = 'last_all_digest_hash' if digest_mode == 'all' else 'last_hourly_digest_hash'
    last_sent_field = 'last_all_digest_at' if digest_mode == 'all' else 'last_hourly_digest_at'
    last_digest_hash = getattr(global_settings, last_hash_field, '') or ''
    email_recipient = global_settings.csv_email or global_settings.alert_email
    email_enabled = global_settings.csv_enabled if global_settings.csv_email or global_settings.alert_email else global_settings.email_enabled

    if total_alerts == 0 or (last_digest_hash and last_digest_hash == digest_hash):
        return {
            'mode': mode,
            'window_label': window_label,
            'station_count': len(station_queryset),
            'results': results,
            'email_sent': False,
            'sms_sent': False,
            'skipped': True,
            'reason': 'no_changes',
        }

    subject = f"[G3 BMS] All stations {window_label} digest"
    context = {
        'title': 'All Stations Digest',
        'window_label': window_label,
        'window_start_label': _format_digest_timestamp(window_start) if window_start is not None else 'All history',
        'window_end_label': _format_digest_timestamp(now),
        'total_alerts': total_alerts,
        'critical_alerts': critical_alerts,
        'warning_alerts': warning_alerts,
        'stations': [
            {
                **station_item,
                'issues': station_item['issues'],
            }
            for station_item in stations
        ],
    }
    text_body, html_body = _render_digest_email(context)
    sms_summary = (
        f"G3 BMS digest: {total_alerts} alerts across {len(stations)} station(s) in {window_label}. "
        f"Critical {critical_alerts}, warning {warning_alerts}."
    )
    if issues:
        top_issues = []
        for issue in issues[:3]:
            top_issues.append(f"{issue['battery_id']} {issue['severity'][0].upper()}x{issue['count']}")
        sms_summary += " Top: " + ", ".join(top_issues)

    overall_email_sent = False
    overall_sms_sent = False

    if total_alerts > 0 and email_enabled and email_recipient:
        email_log = _log_delivery(station_queryset[0], 'email', email_recipient, subject=subject, message=text_body, provider='gmail')
        try:
            _send_digest_email(email_recipient, subject, text_body, html_body)
            email_log.status = 'sent'
            email_log.sent_at = timezone.now()
            email_log.save(update_fields=['status', 'sent_at'])
            overall_email_sent = True
        except Exception as exc:
            email_log.status = 'failed'
            email_log.error = str(exc)
            email_log.save(update_fields=['status', 'error'])
            logger.error("Digest email failed: %s", exc, exc_info=True)

    sms_recipient = global_settings.alert_phone
    sms_enabled = global_settings.sms_enabled
    if total_alerts > 0 and sms_enabled and sms_recipient:
        sms_log = _log_delivery(station_queryset[0], 'sms', sms_recipient, message=sms_summary, provider='twilio')
        try:
            _send_digest_sms(station_queryset[0], sms_recipient, sms_summary)
            sms_log.status = 'sent'
            sms_log.sent_at = timezone.now()
            sms_log.save(update_fields=['status', 'sent_at'])
            overall_sms_sent = True
        except Exception as exc:
            sms_log.status = 'failed'
            sms_log.error = str(exc)
            sms_log.save(update_fields=['status', 'error'])
            logger.error("Digest SMS failed: %s", exc, exc_info=True)

    if overall_email_sent or overall_sms_sent:
        setattr(global_settings, last_hash_field, digest_hash)
        setattr(global_settings, last_sent_field, timezone.now())
        global_settings.save(update_fields=[last_hash_field, last_sent_field, 'updated_at'])

    return {
        'mode': mode,
        'window_label': window_label,
        'station_count': len(station_queryset),
        'results': results,
        'email_sent': overall_email_sent,
        'sms_sent': overall_sms_sent,
        'skipped': False,
    }


def build_daily_csv_report(station: BatteryStation | None = None, report_date: date_cls | None = None) -> tuple[str, str]:
    report_date = report_date or timezone.localdate()
    readings = BatteryReading.objects.select_related('station').filter(timestamp__date=report_date)
    if station is not None:
        readings = readings.filter(station=station)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(['timestamp', 'station_id', 'battery_id', 'voltage_v', 'temperature_c', 'soc', 'soh', 'impedance_ohm'])
    for reading in readings.order_by('station__station_id', 'battery_id', 'timestamp'):
        writer.writerow([
            reading.timestamp.isoformat(),
            reading.station.station_id,
            reading.battery_id,
            f"{reading.voltage / 1000:.2f}",
            f"{reading.temperature / 10:.1f}",
            reading.soc,
            reading.soh,
            reading.imp,
        ])

    filename = f"battery-report-{report_date.isoformat()}.csv"
    return filename, buffer.getvalue()


def send_daily_csv_report(station: BatteryStation | None = None, report_date: date_cls | None = None) -> None:
    report_date = report_date or timezone.localdate()
    station_queryset = [station] if station is not None else list(BatteryStation.objects.filter(is_active=True))
    for item in station_queryset:
        settings_obj = get_station_notification_settings(item)
        global_settings = get_global_notification_settings()
        recipient, csv_enabled = _resolve_channel(
            settings_obj.csv_email or settings_obj.alert_email,
            settings_obj.csv_enabled,
            global_settings.csv_email or global_settings.alert_email,
            global_settings.csv_enabled,
        )
        if not csv_enabled or not recipient:
            _log_delivery(item, 'csv', recipient or '', status='skipped', message='CSV reporting disabled or recipient missing')
            continue

        filename, csv_text = build_daily_csv_report(item, report_date)
        subject = f"[G3 BMS] Daily battery report - {item.station_id} - {report_date.isoformat()}"
        body = f"Attached is the daily battery CSV report for station {item.station_id} on {report_date.isoformat()}."
        log_entry = _log_delivery(item, 'csv', recipient, subject=subject, message=body, provider='gmail')
        try:
            _send_email(subject, body, [recipient], attachment=(filename, csv_text))
            log_entry.status = 'sent'
            log_entry.sent_at = timezone.now()
            log_entry.save(update_fields=['status', 'sent_at'])
        except Exception as exc:
            log_entry.status = 'failed'
            log_entry.error = str(exc)
            log_entry.save(update_fields=['status', 'error'])
            logger.error("Daily CSV mail failed for %s: %s", item.station_id, exc, exc_info=True)
