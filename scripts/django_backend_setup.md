# Battery Monitoring System — Django Backend Setup (Deprecated)

> [!NOTE]
> This backend setup guide is deprecated. The README.md now includes backend setup, MQTT, endpoints, and data model references.

## Overview
This document provides a complete guide for setting up the Django backend with MQTT integration for the battery monitoring system.

## Architecture

\`\`\`
Django Backend
├── Battery Models (SQLite)
├── MQTT Consumer (Celery Task)
├── API Endpoints
└── Alert System
\`\`\`

## Database Schema

### BatteryStation Model
\`\`\`python
class BatteryStation(models.Model):
    station_id = CharField(unique=True)
    name = CharField()
    location = CharField()
    mqtt_broker = CharField()
    mqtt_topic = CharField()
    mqtt_username = CharField()
    mqtt_password = CharField()
    created_at = DateTimeField(auto_now_add=True)
\`\`\`

### BatteryReading Model
\`\`\`python
class BatteryReading(models.Model):
    station = ForeignKey(BatteryStation)
    battery_id = CharField()
    voltage = IntegerField()  # in mV
    temperature = IntegerField()  # in 0.1°C
    soc = IntegerField()  # 0-100%
    soh = IntegerField()  # 0-100%
    imp = IntegerField()  # in mOhms
    timestamp = DateTimeField()
    created_at = DateTimeField(auto_now_add=True)
\`\`\`

### BatteryAlert Model
\`\`\`python
class BatteryAlert(models.Model):
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
    ]
    
    station = ForeignKey(BatteryStation)
    battery_id = CharField()
    severity = CharField(choices=SEVERITY_CHOICES)
    message = TextField()
    data = JSONField()
    acknowledged = BooleanField(default=False)
    timestamp = DateTimeField()
    created_at = DateTimeField(auto_now_add=True)
\`\`\`

## MQTT Data Format

Expected format from MQTT broker:
\`\`\`
Topic: /batteries/[station_id]/data

Message Format:
{
  "timestamp": "20251103T13:15:00",
  "batteries": [
    {
      "battery_id": "B01",
      "V": 12450,
      "T": 286,
      "SOC": 763,
      "SOH": 987,
      "IMP": 125
    },
    {
      "battery_id": "B02",
      "V": 12460,
      "T": 285,
      "SOC": 755,
      "SOH": 981,
      "IMP": 130
    }
  ]
}
\`\`\`

## Implementation Steps

### 1. Install Dependencies
\`\`\`bash
pip install django djangorestframework paho-mqtt celery django-cors-headers python-decouple
\`\`\`

### 2. Create Django Project
\`\`\`bash
django-admin startproject battery_monitoring
cd battery_monitoring
python manage.py startapp batteries
\`\`\`

### 3. Configure Settings
Add to settings.py:
\`\`\`python
INSTALLED_APPS = [
    'rest_framework',
    'corsheaders',
    'batteries',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
]

MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_BROKER_USERNAME = os.getenv('MQTT_BROKER_USERNAME', '')
MQTT_BROKER_PASSWORD = os.getenv('MQTT_BROKER_PASSWORD', '')
\`\`\`

### 4. MQTT Consumer Implementation
\`\`\`python
# batteries/mqtt_client.py
import paho.mqtt.client as mqtt
import json
from .models import BatteryStation, BatteryReading, BatteryAlert
from django.utils import timezone
from datetime import datetime

class MQTTClient:
    def __init__(self, broker, port, username, password):
        self.client = mqtt.Client()
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        
    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            self.process_battery_data(payload)
        except Exception as e:
            print(f"Error processing MQTT message: {e}")
    
    def process_battery_data(self, payload):
        station_id = payload.get('station_id')
        timestamp = payload.get('timestamp')
        
        try:
            station = BatteryStation.objects.get(station_id=station_id)
        except BatteryStation.DoesNotExist:
            return
        
        for battery in payload.get('batteries', []):
            reading = BatteryReading.objects.create(
                station=station,
                battery_id=battery['battery_id'],
                voltage=battery['V'],
                temperature=battery['T'],
                soc=battery['SOC'],
                soh=battery['SOH'],
                imp=battery['IMP'],
                timestamp=datetime.fromisoformat(timestamp)
            )
            
            # Check for alerts
            self.check_battery_alerts(station, battery, reading.timestamp)
    
    def check_battery_alerts(self, station, battery, timestamp):
        voltage = battery['V']
        temperature = battery['T']
        soc = battery['SOC']
        soh = battery['SOH']
        
        alerts = []
        severity = 'info'
        
        if voltage < 11000 or voltage > 13500:
            alerts.append(f"Voltage out of range: {voltage/1000}V")
            severity = 'critical'
        
        if temperature < 0 or temperature > 450:
            alerts.append(f"Temperature out of range: {temperature/10}°C")
            severity = 'critical'
        
        if soc < 20:
            alerts.append(f"Low charge: {soc}%")
            severity = 'warning'
        
        if soh < 80:
            alerts.append(f"Low health: {soh}%")
            severity = 'warning'
        
        if alerts:
            BatteryAlert.objects.create(
                station=station,
                battery_id=battery['battery_id'],
                severity=severity,
                message=" | ".join(alerts),
                data=battery,
                timestamp=timestamp
            )
    
    def connect_and_subscribe(self, topic):
        self.client.on_message = self.on_message
        self.client.username_pw_set(self.username, self.password)
        self.client.connect(self.broker, self.port, 60)
        self.client.subscribe(topic)
        self.client.loop_start()
\`\`\`

### 5. API Endpoints
\`\`\`python
# batteries/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import BatteryStation, BatteryReading, BatteryAlert
from .serializers import BatteryReadingSerializer, BatteryAlertSerializer

class BatteryReadingViewSet(viewsets.ModelViewSet):
    serializer_class = BatteryReadingSerializer
    
    def get_queryset(self):
        queryset = BatteryReading.objects.all()
        station_id = self.request.query_params.get('station_id')
        battery_id = self.request.query_params.get('battery_id')
        
        if station_id:
            queryset = queryset.filter(station__station_id=station_id)
        if battery_id:
            queryset = queryset.filter(battery_id=battery_id)
        
        return queryset.order_by('-timestamp')[:1000]
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        battery_id = request.query_params.get('battery_id')
        station_id = request.query_params.get('station_id')
        limit = int(request.query_params.get('limit', 100))
        
        queryset = BatteryReading.objects.all()
        
        if station_id:
            queryset = queryset.filter(station__station_id=station_id)
        if battery_id:
            queryset = queryset.filter(battery_id=battery_id)
        
        queryset = queryset.order_by('-timestamp')[:limit]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class BatteryAlertViewSet(viewsets.ModelViewSet):
    serializer_class = BatteryAlertSerializer
    
    def get_queryset(self):
        queryset = BatteryAlert.objects.all()
        severity = self.request.query_params.get('severity')
        station_id = self.request.query_params.get('station_id')
        
        if severity:
            queryset = queryset.filter(severity=severity)
        if station_id:
            queryset = queryset.filter(station__station_id=station_id)
        
        return queryset.order_by('-timestamp')
\`\`\`

## Running the Backend

\`\`\`bash
# Migrations
python manage.py makemigrations
python manage.py migrate

# Start MQTT consumer in background
python manage.py mqtt_consumer &

# Run server
python manage.py runserver 0.0.0.0:8000
\`\`\`

## Integration with Frontend

The frontend communicates with Django via:
- `GET /api/batteries/` - Fetch current battery data
- `GET /api/batteries/history/` - Fetch historical data
- `GET /api/alerts/` - Fetch alerts
- `POST /api/batteries/` - Create new battery reading (from MQTT)

All data flows through MQTT → Django → SQLite → API → Frontend
