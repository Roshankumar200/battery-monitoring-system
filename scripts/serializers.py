# Django REST Framework serializers for battery monitoring
from rest_framework import serializers
from .models import BatteryStation, BatteryReading, BatteryAlert

class BatteryStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatteryStation
        fields = [
            'id', 'station_id', 'name', 'facility', 'building', 'zone', 'location',
            'mqtt_broker', 'mqtt_port', 'mqtt_topic', 'mqtt_username', 'mqtt_password',
            'voltage_min', 'voltage_max', 'temperature_min', 'temperature_max', 'soc_min', 'soh_min',
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
