from rest_framework import serializers
from .models import BatteryStation, BatteryReading, BatteryAlert, GlobalNotificationSettings, StationNotificationSettings, NotificationDeliveryLog

class BatteryStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatteryStation
        fields = [
            'id', 'station_id', 'name', 'facility', 'building', 'zone', 'location',
            'mqtt_broker', 'mqtt_port', 'mqtt_topic', 'mqtt_username', 'mqtt_password',
            'voltage_min', 'voltage_max', 'temperature_min', 'temperature_max',
            'soc_min', 'soh_min', 'imp_max',
            'is_active', 'created_at', 'updated_at'
        ]

class BatteryReadingSerializer(serializers.ModelSerializer):
    station_id = serializers.CharField(source='station.station_id', read_only=True)

    class Meta:
        model = BatteryReading
        fields = [
            'id', 'station', 'station_id', 'battery_id', 'voltage', 'temperature', 'soc', 'soh', 'imp', 'timestamp', 'created_at'
        ]
        read_only_fields = ['created_at']

class BatteryAlertSerializer(serializers.ModelSerializer):
    station_id = serializers.CharField(source='station.station_id', read_only=True)

    class Meta:
        model = BatteryAlert
        fields = [
            'id', 'station', 'station_id', 'battery_id', 'severity', 'message', 'voltage', 'temperature', 'soc', 'soh', 'imp',
            'acknowledged', 'acknowledged_at', 'acknowledged_by', 'alert_time', 'created_at'
        ]
        read_only_fields = ['created_at']


class GlobalNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalNotificationSettings
        fields = [
            'id', 'scope', 'alert_email', 'csv_email', 'alert_phone',
            'email_enabled', 'sms_enabled', 'csv_enabled', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'scope', 'created_at', 'updated_at']


class StationNotificationSettingsSerializer(serializers.ModelSerializer):
    station_id = serializers.CharField(source='station.station_id', read_only=True)

    class Meta:
        model = StationNotificationSettings
        fields = [
            'id', 'station', 'station_id', 'alert_email', 'csv_email', 'alert_phone',
            'email_enabled', 'sms_enabled', 'csv_enabled', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'station', 'station_id', 'created_at', 'updated_at']


class NotificationDeliveryLogSerializer(serializers.ModelSerializer):
    station_id = serializers.CharField(source='station.station_id', read_only=True)

    class Meta:
        model = NotificationDeliveryLog
        fields = [
            'id', 'station', 'station_id', 'alert', 'channel', 'recipient', 'subject', 'message',
            'provider', 'status', 'error', 'sent_at', 'created_at',
        ]
        read_only_fields = ['created_at']
