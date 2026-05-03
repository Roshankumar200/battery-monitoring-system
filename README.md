# BMS — Battery Monitoring System

A full-stack real-time battery monitoring platform with MQTT integration, Next.js 14 frontend, and Django REST API backend. Monitor battery stations, track health metrics, receive alerts, and analyze historical data with a clean light/dark theme.

**Tech Stack:**
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/Radix UI, SWR, Recharts
- Backend: Django 4.2, Django REST Framework, paho-mqtt, SQLite
- Integration: MQTT (paho-mqtt) for real-time battery data ingestion


## 🚀 Features

### Real-time Monitoring
- **MQTT Integration**: Auto-connecting consumer subscribes to battery data from MQTT broker
- **Live Dashboard**: Real-time battery status with voltage, temperature, SOC, SOH, impedance
- **Station Management**: Create, configure, and monitor multiple battery stations
- **Alert System**: Automatic threshold-based alerts (critical/warning) with configurable limits

### Analytics & Visualization
- **Historical Charts**: Voltage, temperature, SOC trends over time (Recharts)
- **Battery Details Modal**: Complete analytics for individual batteries
- **CSV Export**: Export station data for external analysis
- **Activity Notifications**: Real-time feed of all system events and alerts

### User Experience
- **Global Theme Toggle**: Seamless light/dark mode with semantic tokens
- **Responsive Design**: Works on desktop, tablet, and mobile
- **One-Click Startup**: Windows launcher starts backend + frontend + MQTT consumer
- **Auto-Refresh**: Data updates every 5 seconds; manual refresh button available


## 🧭 Architecture

```
Battery Hardware → MQTT Broker → Django Consumer → SQLite → REST API → Next.js UI

┌─────────────────┐    MQTT Topic          ┌──────────────────────┐    HTTP/REST    ┌───────────────────┐
│ Battery Devices │ ─────────────────────▶ │   Django Backend     │ ──────────────▶ │  Next.js Frontend │
│  (V,T,SOC,SOH)  │ /batteries/+/data      │ • Auto MQTT consumer │                │  • Dashboards     │
│                 │                        │ • Alert generation   │                │  • Charts         │
└─────────────────┘                        │ • DRF API            │                │  • Station Mgmt   │
                                           │ • SQLite DB          │                └───────────────────┘
                                           └──────────────────────┘
```

**Data Flow:**
1. Battery devices publish data to MQTT broker (e.g., Mosquitto, HiveMQ)
2. Django MQTT consumer auto-starts with backend, subscribes to `/batteries/+/data`
3. Consumer normalizes payload, saves `BatteryReading`, generates `BatteryAlert` if thresholds exceeded
4. REST API serves latest readings (deduplicated per battery) and historical data
5. Next.js frontend polls API every 5s, displays live data and charts


## 📁 Project Structure

```
.
├── app/                          # Next.js App Router pages
│   ├── command-center/           # Main dashboard - stations overview
│   ├── battery-stations/         # Station list and detail pages
│   │   └── [stationId]/          # Individual station view with battery grid
│   ├── activity/                 # Activity notifications and alerts
│   └── layout.tsx                # Global layout with sidebar/topbar
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── battery-mini-card.tsx     # Battery status tile
│   ├── activity-notification.tsx # Alert notification component
│   ├── threshold-settings.tsx    # Global threshold configuration dialog
│   └── global-sidebar.tsx        # Navigation sidebar
├── hooks/                        # React hooks
│   ├── use-batteries.ts          # SWR hooks for batteries, history, alerts
│   └── use-thresholds.ts         # localStorage-backed threshold settings
├── backend/                      # Django project
│   ├── batteries/                # Main app
│   │   ├── models.py             # BatteryStation, BatteryReading, BatteryAlert
│   │   ├── views.py              # DRF viewsets
│   │   ├── mqtt_client.py        # MQTT consumer with alert logic
│   │   ├── apps.py               # Auto-start MQTT consumer on Django ready()
│   │   └── management/commands/
│   │       ├── mqtt_consumer.py  # Manual consumer command (optional)
│   │       └── mqtt_publish.py   # Test payload publisher
│   ├── config/                   # Django settings
│   ├── manage.py
│   └── requirements.txt
├── scripts/                      # Setup helpers
│   ├── init_battery_db.sql       # Database schema
│   └── seed_sample_data.py       # Sample data seeder
├── start_dev.bat                 # Windows: start backend + frontend
├── frontend_dev.bat              # Windows: frontend only
└── package.json                  # Node dependencies
```


## ✅ Prerequisites

- **Node.js** 18+ (for Next.js)
- **Python** 3.9+ (for Django)
- **MQTT Broker** (Mosquitto, HiveMQ Cloud, EMQX, etc.)
  - Test locally: `docker run -d -p 1883:1883 eclipse-mosquitto`
- **Windows** (for .bat launchers) or Unix shell


## 🟩 Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/Roshankumar200/battery-monitoring-system.git
cd bms

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows PowerShell
# OR: .venv\Scripts\activate.bat  # Windows CMD
# OR: source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
```

### 2. Configure Environment

Create `backend/.env`:
```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (SQLite default)
DATABASE_URL=sqlite:///battery.db

# MQTT (optional - can also configure per-station in DB)
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC=/batteries/+/data
MQTT_DEBUG=1
```

Create `.env.local` in project root:
```env
# Point frontend to Django backend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Initialize Database

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser  # Optional - for Django admin
```

### 4. Create a Battery Station

**Option A - Django Admin UI:**
```bash
python manage.py runserver
# Visit http://localhost:8000/admin
# Login with superuser credentials
# Add BatteryStation with MQTT broker details
```

**Option B - Django shell:**
```python
python manage.py shell
```
```python
from batteries.models import BatteryStation

station = BatteryStation.objects.create(
    station_id='STN-01',
    name='Main Battery Station',
    facility='Data Center A',
    building='Building 1',
    zone='Zone 3',
    mqtt_broker='broker.hivemq.com',  # Your MQTT broker
    mqtt_port=1883,
    mqtt_topic='batteries/STN-01/data',
    mqtt_username='',  # Optional
    mqtt_password='',  # Optional
    voltage_min=11000,   # 11.0V in mV
    voltage_max=13500,   # 13.5V in mV
    temperature_min=0,   # 0°C in 0.1°C units
    temperature_max=450, # 45°C in 0.1°C units
    soc_min=20,          # 20%
    soh_min=80,          # 80%
    is_active=True
)
```

### 5. Start the System

**Windows (Recommended):**
```bash
# From project root - starts backend + frontend + MQTT consumer
.\start_dev.bat
```

**Manual Start:**

Terminal 1 - Backend:
```bash
cd backend
.venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000
# MQTT consumer auto-starts with backend
```

Terminal 2 - Frontend:
```bash
npm run dev
# Opens at http://localhost:3000
```

### 6. Test MQTT Integration

The MQTT consumer auto-starts with Django. To verify:

1. Check backend terminal - you should see:
```
======================================================================
Starting MQTT Consumers...
======================================================================
Station: STN-01 - Main Battery Station
  Broker: broker.hivemq.com:1883
  Topic: batteries/STN-01/data
  ✓ Connected and subscribed
======================================================================
```

2. Publish test data (from another terminal):
```bash
cd backend
python manage.py mqtt_publish STN-01 --count 12 --interval 1
```

3. Watch backend logs - you'll see incoming messages:
```
[MQTT] Received message on topic: batteries/STN-01/data
[MQTT] Payload: { ... }
[MQTT] Ingested STN-01/B01 @ 2025-11-05 12:34:56 V=12480mV T=282 SOC=92% SOH=97% IMP=118
```

4. Open frontend at http://localhost:3000 - data should appear!


## 🔌 MQTT Protocol

### Topic Pattern
```
/batteries/[station_id]/data
```
Example: `/batteries/STN-01/data`

### Payload Format (JSON)
```json
{
  "station_id": "STN-01",
  "timestamp": "2025-11-05T12:34:56Z",
  "batteries": [
    {
      "battery_id": "B01",
      "V": 12450,    // Voltage in millivolts (mV)
      "T": 286,      // Temperature in 0.1°C (286 = 28.6°C)
      "SOC": 76,     // State of Charge: 0-100% (or 0-1000 for deci-percent)
      "SOH": 98,     // State of Health: 0-100% (or 0-1000 for deci-percent)
      "IMP": 125     // Impedance in milliohms (mΩ)
    }
  ]
}
```

### Data Normalization
The backend automatically normalizes values:
- **Voltage**: Used as-is (mV)
- **Temperature**: Used as-is (0.1°C), UI displays in °C
- **SOC/SOH**: If >100, divided by 10 and capped at 100%
  - Example: `763` → `76.3%` → `76%`

### Alert Thresholds
Alerts are generated when readings exceed station thresholds:
- **Voltage**: Below `voltage_min` or above `voltage_max`
- **Temperature**: Below `temperature_min` or above `temperature_max`
- **SOC**: Below `soc_min`
- **SOH**: Below `soh_min`
- **Impedance**: Above `imp_max` (if configured via env `IMP_MAX_DEFAULT`)

**Severity calculation:**
- **Critical**: Large deviation (e.g., voltage Δ ≥ 0.2V, temp Δ ≥ 5°C, SOC Δ ≥ 15%)
- **Warning**: Smaller deviation


## 📡 API Reference

### Base URL
- Development: `http://localhost:8000`
- Set via `NEXT_PUBLIC_API_URL` in frontend `.env.local`

### Endpoints

#### Stations
```http
GET    /api/stations/           # List all stations
POST   /api/stations/           # Create station
GET    /api/stations/{id}/      # Get station details
PUT    /api/stations/{id}/      # Update station
DELETE /api/stations/{id}/      # Delete station
```

#### Batteries
```http
# Get latest reading for each battery
GET /api/batteries/?station_id={id}&battery_id={id}

# Get historical readings
GET /api/batteries/history/?station_id={id}&battery_id={id}&limit=100
```

Response (latest):
```json
[
  {
    "station_id": "STN-01",
    "battery_id": "B01",
    "voltage": 12450,
    "temperature": 286,
    "soc": 88,
    "soh": 95,
    "imp": 125,
    "timestamp": "2025-11-05T12:34:56Z",
    "created_at": "2025-11-05T12:34:57Z"
  }
]
```

#### Alerts
```http
# Get alerts
GET /api/alerts/?station_id={id}&severity={critical|warning|info}

# Create alert (auto-generated by MQTT consumer)
POST /api/alerts/
```

Response:
```json
[
  {
    "station_id": "STN-01",
    "battery_id": "B01",
    "severity": "critical",
    "message": "Voltage 10.9V below min 11.0V (Δ -0.1V)",
    "voltage": 10900,
    "temperature": 286,
    "soc": 45,
    "soh": 82,
    "imp": 130,
    "alert_time": "2025-11-05T12:34:56Z",
    "acknowledged": false
  }
]
```


## 🎨 Frontend Features

### Pages
- **Command Center** (`/`) - Station overview, battery counts, critical alerts
- **Battery Stations** (`/battery-stations/[id]`) - Live battery grid, threshold settings
- **Activity** (`/activity`) - Alert notifications and system events

### Components
- **BatteryMiniCard** - Compact battery status tile with health bar and metrics
- **ActivityNotification** - Alert display with severity color coding
- **ThresholdSettings** - Configure global alert thresholds (localStorage)
- **BatteryDetailsModal** - Full analytics with historical charts
- **BatteryExport** - CSV export for station data

### Hooks
```typescript
// Fetch batteries (auto-refresh every 5s)
const { batteries, isLoading } = useBatteries(stationId?)

// Fetch history for charts
const { history } = useBatteryHistory(stationId, batteryId, limit)

// Fetch alerts
const { alerts } = useBatteryAlerts(stationId?, severity?)

// Manage stations
const { stations } = useStations()
const { station } = useStation(stationId)
await createStation(payload)
await updateStationConfig(stationId, payload)
await deleteStation(stationId)

// Global thresholds (localStorage)
const { thresholds, setThresholds, resetThresholds } = useThresholds()
```


## 🔧 Configuration

### Backend Settings (backend/.env)

```env
# Django Core
SECRET_KEY=your-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///battery.db

# MQTT (global defaults - can be overridden per-station in DB)
MQTT_BROKER_HOST=broker.hivemq.com
MQTT_BROKER_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC=/batteries/+/data

# Debug
MQTT_DEBUG=1                    # Enable verbose MQTT logging

# Optional
IMP_MAX_DEFAULT=150             # Default impedance threshold (mΩ)
```

### Frontend Settings (.env.local)

```env
# Point to Django backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Or leave blank to use mock API routes (dev mode)
# NEXT_PUBLIC_API_URL=
```

### Per-Station MQTT Config

Each `BatteryStation` in the database has its own MQTT credentials:
- `mqtt_broker` - Broker hostname/IP
- `mqtt_port` - Broker port (default 1883)
- `mqtt_topic` - Station-specific topic (e.g., `batteries/STN-01/data`)
- `mqtt_username` - Optional authentication
- `mqtt_password` - Optional authentication

The MQTT consumer connects to ALL active stations simultaneously.


## 🛠️ Development

### Running Tests
```bash
# Backend
cd backend
python manage.py test

# Frontend
npm run test
```

### Type Checking
```bash
# Frontend TypeScript
npx tsc --noEmit
```

### Linting
```bash
# Frontend
npm run lint

# Backend
cd backend
flake8 .
```

### Database Migrations
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Seed Sample Data
```bash
cd backend
python manage.py shell < ../scripts/seed_sample_data.py
```


## 🚢 Production Deployment

### Frontend (Vercel/Node Host)
```bash
npm run build
npm start
```

Environment:
- Set `NEXT_PUBLIC_API_URL` to production backend URL
- Configure domain and SSL

### Backend (Gunicorn/Nginx)
```bash
cd backend
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

Recommended setup:
- **WSGI Server**: Gunicorn or Uvicorn
- **Reverse Proxy**: Nginx or Caddy
- **Database**: PostgreSQL (replace SQLite)
- **MQTT**: Use TLS port 8883 for security
- **CORS**: Allow only production frontend origin
- **Environment**: Use system env vars or .env file

### MQTT Consumer
The consumer auto-starts with Django (via `apps.py`). For production:
- Ensure broker is accessible and uses TLS
- Monitor logs for connection issues
- Consider running as systemd service or supervisor

### Database
For production, migrate from SQLite to PostgreSQL:
```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'bms_db',
        'USER': 'postgres',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```


## 🐛 Troubleshooting

### MQTT consumer not receiving data
1. **Check broker connection**:
   - Verify `MQTT_BROKER_HOST` and `MQTT_BROKER_PORT`
   - Test with `mosquitto_sub -h broker.hivemq.com -t 'batteries/+/data'`

2. **Check station exists**:
   - Consumer ignores messages for unknown `station_id`
   - Create `BatteryStation` in Django admin or via API

3. **Enable debug logging**:
   ```bash
   # Backend terminal
   export MQTT_DEBUG=1    # Linux/Mac
   set MQTT_DEBUG=1       # Windows CMD
   $env:MQTT_DEBUG='1'    # Windows PowerShell
   ```

4. **Check backend logs**:
   - Look for `[MQTT] Received message on topic: ...`
   - Look for `[MQTT] Ingested STN-01/B01 ...`

### Frontend not showing data
1. **Verify API connection**:
   - Check `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
   - Restart frontend: `npm run dev`

2. **Check browser console**:
   - Look for CORS errors or API fetch failures
   - Verify API returns data: `curl http://localhost:8000/api/batteries/?station_id=STN-01`

3. **Check backend CORS**:
   - Ensure `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` include frontend URL

### Duplicate batteries in UI
- Fixed! API now returns only latest reading per battery
- If still seeing duplicates, clear browser cache and refresh

### Windows .bat scripts not working
- Ensure Python is in PATH
- Edit `backend/dev_server.bat` to use `python` instead of `py` if needed
- Run PowerShell as Administrator if permission errors occur


## 📝 Management Commands

### MQTT Consumer (Manual)
```bash
cd backend
python manage.py mqtt_consumer
```
Note: Consumer auto-starts with Django - this command is for standalone use.

### Publish Test Data
```bash
cd backend
python manage.py mqtt_publish STN-01 --count 36 --interval 0.5
```
Publishes realistic battery data to `/batteries/STN-01/data`.

### Database Shell
```bash
cd backend
python manage.py shell
```

### Create Superuser
```bash
cd backend
python manage.py createsuperuser
```


## 📜 License

Proprietary — All rights reserved. Contact maintainers for usage permissions.


## 🤝 Contributing

Contact repository owner for contribution guidelines.


## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Contact: [Repository Owner]


## 👥 Contributors

This project was developed as a collaborative effort by a two-member team.

### 🔹 Roshan Kumar Sahu
- Led backend development using Django REST Framework  
- Implemented MQTT-based real-time data ingestion  
- Designed alert processing logic and system integration  

### 🔹 Yash Pathak
- Led frontend development using Next.js  
- Built dashboard UI components and data visualizations  
- Contributed to backend integration  

### 🤝 Collaboration
Both contributors collaborated on system architecture, feature design, and end-to-end integration of the Battery Monitoring System (BMS).


---

**Built with ❤️ for real-time battery monitoring**
