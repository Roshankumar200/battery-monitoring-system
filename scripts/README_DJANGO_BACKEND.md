# Django Backend Reference for Battery Monitoring (Deprecated)

> [!NOTE]
> This reference is deprecated. Please see the root README.md for the single, consolidated documentation covering backend models, serializers, viewsets, MQTT consumer, and integration.

This folder contains reference code you can drop into your Django project. It defines models, serializers, viewsets, and an MQTT client to process battery data and expose APIs.

## Models

See `models.py` for:
- BatteryStation (editable fields per station)
  - station_id (unique), name, facility, building, zone, location
  - mqtt_broker, mqtt_port, mqtt_topic, mqtt_username, mqtt_password
  - limits: voltage_min/max, temperature_min/max, soc_min, soh_min
- BatteryReading (per-battery samples)
- BatteryAlert (threshold-driven alerts)

Run migrations after adding to your Django app:
```
python manage.py makemigrations
python manage.py migrate
```

## Serializers & Views

- `serializers.py`: DRF serializers for all models
- `views.py`: DRF viewsets
  - BatteryStationViewSet (lookup by station_id)
  - BatteryReadingViewSet (list/retrieve, history action)
  - BatteryAlertViewSet

Wire them in your `urls.py`:
```python
from rest_framework import routers
from batteries.views import BatteryStationViewSet, BatteryReadingViewSet, BatteryAlertViewSet

router = routers.DefaultRouter()
router.register(r'stations', BatteryStationViewSet, basename='station')
router.register(r'batteries', BatteryReadingViewSet, basename='battery')
router.register(r'batteries/alerts', BatteryAlertViewSet, basename='alerts')

urlpatterns = [
    path('api/', include(router.urls)),
]
```

## MQTT Consumer

- `mqtt_client.py`: Paho MQTT client to parse messages and create readings/alerts
- Accepts either of these formats:
  - Topic: `/batteries/<station_id>/data` (station inferred from topic)
  - Payload includes `station_id`
- Normalization:
  - Voltage (mV), Temperature (0.1°C)
  - SOC/SOH can be 0–100 or deci-% (e.g., 763 => 76.3%); values >100 normalized

Settings:
```python
# settings.py
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_BROKER_USERNAME = os.getenv('MQTT_BROKER_USERNAME', '')
MQTT_BROKER_PASSWORD = os.getenv('MQTT_BROKER_PASSWORD', '')
MQTT_TOPIC = os.getenv('MQTT_TOPIC', '/batteries/+/data')
```

Management command (example location `batteries/management/commands/mqtt_consumer.py`):
```bash
python manage.py mqtt_consumer
```

## Frontend Integration (Next.js)

Set env var to point frontend at Django:
```
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The hooks automatically switch to Django when this is set:
- `useBatteries(stationId)` → GET `/api/batteries?station_id=...`
- `useBatteryHistory(stationId, batteryId)` → GET `/api/batteries/history?station_id=...&battery_id=...`
- `useBatteryAlerts(stationId)` → GET `/api/batteries/alerts?station_id=...`
- `useStation(stationId)` / `useStations()` → GET `/api/stations/` (Django only)
- `updateStationConfig(stationId, payload)` → PUT `/api/stations/<station_id>/`

## Realtime

- Out of the box, the frontend polls alerts every 5s for a live feel.
- For true push, enable one of:
  - MQTT over WebSockets to subscribe in-browser
  - Django Channels (WebSockets) or Server-Sent Events broadcasting new alerts

## Testing MQTT

Publish a sample message:
```json
{
  "station_id": "STN-01",
  "timestamp": "20251103T13:15:00",
  "batteries": [
    {"battery_id":"B01","V":12450,"T":286,"SOC":76,"SOH":98,"IMP":125}
  ]
}
```
Topic: `/batteries/STN-01/data`

Verify:
- Readings appear in `/api/batteries?station_id=STN-01`
- Alerts in `/api/batteries/alerts?station_id=STN-01`
- Station can be edited via `/api/stations/STN-01/`
