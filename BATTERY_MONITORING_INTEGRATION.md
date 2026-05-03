# Battery Monitoring System — Complete Integration Guide (Deprecated)

> [!NOTE]
> This document is deprecated. Please see README.md for the consolidated, up-to-date guide (architecture, MQTT, data formats, setup, and APIs).

## System Architecture

\`\`\`
┌─────────────────┐
│ Battery Hardware│
│   (Physical)    │
└────────┬────────┘
         │
         │ MQTT Data Stream
         │ (Timestamp, Battery_ID, V, T, SOC, SOH, IMP)
         │
┌────────▼────────────────┐
│  MQTT Broker            │
│  (mosquitto/HiveMQ)     │
└────────┬────────────────┘
         │
         │ Subscribe to /batteries/+/data
         │
┌────────▼────────────────┐
│ Django Backend          │
│ ├─ MQTT Consumer        │
│ ├─ SQLite Database      │
│ ├─ Alert System         │
│ └─ REST API             │
└────────┬────────────────┘
         │
         │ HTTP/REST API
         │
┌────────▼────────────────┐
│ Next.js Frontend        │
│ ├─ Command Center       │
│ ├─ Battery Cards        │
│ ├─ Analytics Dashboard  │
│ └─ Alert System         │
└────────────────────────┘
\`\`\`

## Data Flow

### 1. MQTT Message Flow
\`\`\`
Hardware sends: 
{
  "station_id": "STN-01",
  "timestamp": "20251103T13:15:00",
  "batteries": [
    {
      "battery_id": "B01",
      "V": 12450,        // Voltage in mV
      "T": 286,          // Temperature in 0.1°C
      "SOC": 76,         // State of Charge % (0-100) or deci-% (e.g., 763 => 76.3%)
      "SOH": 98,         // State of Health % (0-100) or deci-% (e.g., 987 => 98.7%)
      "IMP": 125         // Impedance in mOhms
    }
  ]
}
\`\`\`

### 2. Django Processing
- MQTT consumer receives message
- Validates station credentials
- Creates BatteryReading in SQLite
- Checks alert thresholds
- Creates BatteryAlert if needed
- Stores historical data

Normalization rules:
- Voltage (V) is expected in millivolts (mV)
- Temperature (T) is expected in tenths of °C (e.g., 286 = 28.6°C)
- SOC/SOH can be sent as:
  - integer percent (0-100), or
  - deci-percent (e.g., 763 -> 76.3%). Server normalizes values >100 by dividing by 10 and clamping to 100.

### 3. Frontend Display
- Fetches current readings via API
- Renders BatteryCard components with:
  - Color-coded border based on SOC
  - Health indicator dot based on SOH
  - Real-time parameter display
- Click to open analytics modal
- Displays charts from historical data

## Configuration

### Environment Variables

**Frontend (.env.local):**
\`\`\`
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MQTT_BROKER=localhost
NEXT_PUBLIC_MQTT_PORT=8883
\`\`\`

**Django (.env):**
\`\`\`
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_BROKER_USERNAME=admin
MQTT_BROKER_PASSWORD=password
MQTT_TOPIC=/batteries/+/data

DATABASE_URL=sqlite:///battery.db

SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,yourserver.com
\`\`\`

### MQTT Broker Setup

#### HiveMQ Cloud (Recommended for Production)
1. Create account at https://console.hivemq.cloud
2. Create cluster
3. Add username/password under Access Management
4. Configure firewall rules
5. Update Django settings with broker URL

#### Local Mosquitto
\`\`\`bash
# Install
sudo apt-get install mosquitto mosquitto-clients

# Configure /etc/mosquitto/mosquitto.conf
allow_anonymous false
password_file /etc/mosquitto/passwd
listener 1883

# Create user
sudo mosquitto_passwd -c /etc/mosquitto/passwd admin

# Test connection
mosquitto_pub -h localhost -u admin -P password -t test -m "Hello"
\`\`\`

## Backend Setup (Detailed)

### Step 1: Create Django Project
\`\`\`bash
mkdir battery-monitoring
cd battery-monitoring
python -m venv venv
source venv/bin/activate

django-admin startproject config .
python manage.py startapp batteries
\`\`\`

### Step 2: Install Dependencies
\`\`\`bash
pip install \
  Django==4.2 \
  djangorestframework==3.14 \
  django-cors-headers==4.0 \
  paho-mqtt==1.6.1 \
  celery==5.3 \
  redis==4.5 \
  python-decouple==3.8
\`\`\`

### Step 3: Update settings.py
\`\`\`python
# config/settings.py
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'batteries',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# MQTT Configuration
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_BROKER_USERNAME = os.getenv('MQTT_BROKER_USERNAME', '')
MQTT_BROKER_PASSWORD = os.getenv('MQTT_BROKER_PASSWORD', '')
MQTT_TOPIC = os.getenv('MQTT_TOPIC', '/batteries/+/data')
\`\`\`

### Step 4: Create Models (batteries/models.py)
[See models.py file above]

### Step 5: Create Serializers
\`\`\`python
# batteries/serializers.py
from rest_framework import serializers
from .models import BatteryReading, BatteryAlert, BatteryStation

class BatteryStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatteryStation
        fields = '__all__'

class BatteryReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatteryReading
        fields = '__all__'

class BatteryAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatteryAlert
        fields = '__all__'
\`\`\`

### Step 6: Create MQTT Consumer
[See mqtt_client.py implementation above]

### Step 7: Run Migrations
\`\`\`bash
python manage.py makemigrations batteries
python manage.py migrate
\`\`\`

### Step 8: Create Management Command for MQTT
\`\`\`python
# batteries/management/commands/mqtt_consumer.py
from django.core.management.base import BaseCommand
from batteries.mqtt_client import MQTTClient
from django.conf import settings

class Command(BaseCommand):
    help = 'Start MQTT client for battery monitoring'

    def handle(self, *args, **options):
        client = MQTTClient(
            settings.MQTT_BROKER_HOST,
            settings.MQTT_BROKER_PORT,
            settings.MQTT_BROKER_USERNAME,
            settings.MQTT_BROKER_PASSWORD
        )
        
        client.connect_and_subscribe(settings.MQTT_TOPIC)
        
        try:
            self.stdout.write(
                self.style.SUCCESS('MQTT client started. Press CTRL+C to stop.')
            )
            while True:
                pass
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('Stopping MQTT client...'))
            client.client.loop_stop()
\`\`\`

## Frontend Integration

### Setup React Components

1. **BatteryCard** - Individual battery display
   - Border color based on SOC: Red (≤33%), Yellow (33-66%), Green (≥67%)
   - Health indicator dot based on SOH: Red (≤50%), Yellow (50-80%), Green (≥80%)
   - Shows: Voltage, Temperature, Impedance, SOC%
   - Clickable to open analytics

2. **BatteryDetailsModal** - Analytics dashboard
   - Line chart: Voltage trends
   - Area chart: Temperature trends
   - Bar chart: SOC trends
   - Current status cards
   - Timestamp of data

3. **Command Center Integration**
   - Display all active batteries in grid
   - Show count of batteries per station
   - Real-time updates (poll every 5-10 seconds)

### API Integration

\`\`\`typescript
// Frontend API calls

// Get current battery readings
fetch('/api/batteries/', {
  params: {
    stationId: 'STN-01',
    batteryId: 'B01'
  }
})

// Get battery history
fetch('/api/batteries/history/', {
  params: {
    stationId: 'STN-01',
    batteryId: 'B01',
    limit: 100
  }
})

// Get alerts
fetch('/api/alerts/', {
  params: {
    stationId: 'STN-01',
    severity: 'critical'
  }
})
\`\`\`

## Monitoring & Maintenance

### Key Metrics to Track
- Battery voltage stability
- Temperature trends
- SOC discharge rate
- SOH degradation rate
- Alert frequency
- MQTT message throughput

### Database Optimization
- Implement data archival (move old data to separate table)
- Create indexes on frequently queried fields
- Regular database optimization and cleanup

### Performance Considerations
- MQTT consumer should be horizontally scalable
- Cache frequently accessed data
- Implement message queue for high-frequency data
- Archive historical data after 90 days

## Troubleshooting

### MQTT Connection Issues
\`\`\`bash
# Test MQTT connection
mosquitto_sub -h mqtt.broker.com -u username -P password -t "/batteries/+/data"

# Check Django logs
tail -f django.log
\`\`\`

### Data Not Showing in Frontend
1. Check MQTT connection in Django logs
2. Verify database has BatteryReading entries
3. Test API endpoint directly
4. Check CORS settings

### High Memory Usage
- Reduce history data retention
- Implement pagination in API
- Archive old data to separate storage

## Security Considerations

- Use MQTT over TLS (MQTT-TLS port 8883)
- Implement JWT authentication for API
- Use environment variables for secrets
- Implement rate limiting on API endpoints
- Regular security updates for dependencies
