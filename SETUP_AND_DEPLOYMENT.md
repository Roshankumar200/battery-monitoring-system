# Battery Monitoring System — Setup & Deployment Guide (Deprecated)

> [!NOTE]
> This document is deprecated. Please see README.md for consolidated setup, deployment, Docker, MQTT, and production guidance.

## Quick Start

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- MQTT Broker (HiveMQ, Mosquitto)
- Git

### Frontend Setup (Next.js)

\`\`\`bash
# Clone repository (assuming you have the code)
git clone <your-repo>
cd battery-monitoring-frontend

# Install dependencies
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

# Run development server
npm run dev

# Build for production
npm run build
npm start
\`\`\`

Frontend runs on: http://localhost:3000

### Backend Setup (Django)

\`\`\`bash
# Create project directory
mkdir battery-monitoring-backend
cd battery-monitoring-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Create requirements.txt
cat > requirements.txt << EOF
Django==4.2
djangorestframework==3.14
django-cors-headers==4.0
paho-mqtt==1.6.1
python-decouple==3.8
EOF

# Install dependencies
pip install -r requirements.txt

# Create Django project
django-admin startproject config .
python manage.py startapp batteries

# Copy models.py from provided file
# Create serializers, views, urls, etc.

# Run migrations
python manage.py makemigrations batteries
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Run development server
python manage.py runserver 0.0.0.0:8000

# In another terminal, start MQTT consumer
python manage.py mqtt_consumer
\`\`\`

Backend runs on: http://localhost:8000
Admin: http://localhost:8000/admin

### MQTT Broker Setup

#### Option 1: Use HiveMQ Cloud (Recommended for Production)
1. Go to https://console.hivemq.cloud
2. Sign up for free account
3. Create cluster
4. Get broker address, username, password
5. Update Django .env file

#### Option 2: Local Mosquitto
\`\`\`bash
# Linux
sudo apt-get install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Windows - Download installer from mosquitto.org

# Start service
sudo systemctl start mosquitto
# or
mosquitto -c /etc/mosquitto/mosquitto.conf

# Test connection
mosquitto_pub -h localhost -u admin -P password -t test/topic -m "Test message"
\`\`\`

## Production Deployment

### Frontend Deployment (Vercel)

\`\`\`bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# NEXT_PUBLIC_API_URL=https://your-api.com
\`\`\`

### Backend Deployment (AWS/Digital Ocean/Heroku)

#### Using Gunicorn + Nginx

\`\`\`bash
# Install Gunicorn
pip install gunicorn whitenoise

# Create Procfile
echo "web: gunicorn config.wsgi --log-file -" > Procfile

# Update settings.py
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MIDDLEWARE = [
    'whitenoise.middleware.WhiteNoiseMiddleware',
    ...
]

# Collect static files
python manage.py collectstatic

# Run Gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4

# Setup Nginx reverse proxy
# /etc/nginx/sites-available/battery-api
upstream django {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://django;
        proxy_set_header Host $host;
    }
    
    location /static/ {
        alias /path/to/staticfiles/;
    }
}
\`\`\`

#### Using Docker

\`\`\`dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
\`\`\`

\`\`\`bash
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: battery_db
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mqtt:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

  web:
    build: .
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    environment:
      DEBUG: "False"
      DATABASE_URL: postgresql://admin:password@db:5432/battery_db
      MQTT_BROKER_HOST: mqtt
    depends_on:
      - db
      - mqtt

  mqtt_consumer:
    build: .
    command: python manage.py mqtt_consumer
    environment:
      DEBUG: "False"
      DATABASE_URL: postgresql://admin:password@db:5432/battery_db
      MQTT_BROKER_HOST: mqtt
    depends_on:
      - db
      - mqtt

volumes:
  postgres_data:
\`\`\`

\`\`\`bash
# Deploy with Docker Compose
docker-compose up -d
\`\`\`

## Monitoring & Logging

### Django Logging Configuration

\`\`\`python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/battery_monitoring.log',
            'maxBytes': 1024000,
            'backupCount': 3,
        },
    },
    'loggers': {
        'batteries': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
\`\`\`

### Performance Monitoring

\`\`\`bash
# Install monitoring tools
pip install django-extensions
pip install django-debug-toolbar

# Monitor MQTT connection
mosquitto_sub -h broker.address -u admin -P password -v -t '/batteries/+/data'

# Monitor database
python manage.py dbshell
> SELECT COUNT(*) FROM batteries_batteryreading;
> SELECT COUNT(*) FROM batteries_batteryalert;
\`\`\`

## Scaling Considerations

### High Volume MQTT Messages
- Implement message queue (RabbitMQ/Redis)
- Use Celery for async processing
- Horizontal scaling with multiple workers

### Database Optimization
- Add indexes to frequently queried fields
- Archive historical data after retention period
- Use read replicas for analytics queries

### API Performance
- Implement caching (Redis)
- Pagination for large datasets
- Rate limiting per client

## Backup & Recovery

\`\`\`bash
# Backup database
python manage.py dumpdata > backup.json

# Backup SQLite database
cp db.sqlite3 db.sqlite3.backup

# Docker volume backup
docker cp battery-monitoring_db:/var/lib/postgresql/data ./backup

# Restore
python manage.py loaddata backup.json
\`\`\`

## Troubleshooting Checklist

- [ ] MQTT broker is running and accessible
- [ ] Django can connect to MQTT broker
- [ ] Frontend API URL is correctly configured
- [ ] CORS is enabled in Django
- [ ] Database migrations are complete
- [ ] Static files are collected
- [ ] Environment variables are set
- [ ] Firewall rules allow MQTT port
- [ ] SSL certificates are valid (if using TLS)

## Support & Resources

- Next.js docs: https://nextjs.org/docs
- Django docs: https://docs.djangoproject.com
- MQTT docs: https://mqtt.org/
- Recharts docs: https://recharts.org/
