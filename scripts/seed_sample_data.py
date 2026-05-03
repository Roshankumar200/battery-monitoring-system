"""
Seed sample battery data into the database for testing
Run with: python manage.py shell < seed_sample_data.py
"""

import os
import django
from datetime import datetime, timedelta
import random
import uuid

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from batteries.models import BatteryStation, BatteryReading, BatteryAlert

def seed_data():
    # Get or create stations
    station1, created = BatteryStation.objects.get_or_create(
        station_id='STN-01',
        defaults={
            'id': str(uuid.uuid4()),
            'name': 'Main Station',
            'location': 'Building A, Floor 2',
            'mqtt_broker': 'localhost',
            'mqtt_port': 1883,
            'mqtt_topic': '/batteries/STN-01/data',
            'mqtt_username': 'admin',
            'mqtt_password': 'password',
            'is_active': True,
        }
    )

    station2, created = BatteryStation.objects.get_or_create(
        station_id='STN-02',
        defaults={
            'id': str(uuid.uuid4()),
            'name': 'Secondary Station',
            'location': 'Building B, Floor 1',
            'mqtt_broker': 'localhost',
            'mqtt_port': 1883,
            'mqtt_topic': '/batteries/STN-02/data',
            'mqtt_username': 'admin',
            'mqtt_password': 'password',
            'is_active': True,
        }
    )

    print(f"✓ Station 1: {station1.station_id} - {station1.name}")
    print(f"✓ Station 2: {station2.station_id} - {station2.name}")

    # Create sample readings for the last 24 hours
    stations = [station1, station2]
    batteries = ['B01', 'B02', 'B03']
    
    now = datetime.now()
    
    for station in stations:
        for battery_id in batteries:
            for hours_ago in range(24):
                timestamp = now - timedelta(hours=hours_ago)
                
                # Generate realistic data
                voltage = random.randint(12000, 13000)  # 12.0V to 13.0V
                temperature = random.randint(250, 300)  # 25°C to 30°C
                soc = random.randint(20, 100)  # 20% to 100% charge
                soh = random.randint(70, 100)  # 70% to 100% health
                imp = random.randint(100, 150)  # Impedance
                
                BatteryReading.objects.create(
                    id=str(uuid.uuid4()),
                    station=station,
                    battery_id=battery_id,
                    voltage=voltage,
                    temperature=temperature,
                    soc=soc,
                    soh=soh,
                    imp=imp,
                    timestamp=timestamp,
                )
    
    print(f"\n✓ Created 72 sample readings (3 batteries × 24 hours × 2 stations)")

    # Create some sample alerts
    critical_count = 0
    warning_count = 0
    
    for station in stations:
        for battery_id in batteries:
            # Random critical alert
            if random.random() > 0.7:
                BatteryAlert.objects.create(
                    id=str(uuid.uuid4()),
                    station=station,
                    battery_id=battery_id,
                    severity='critical',
                    message=f'Voltage out of range: {random.randint(10, 14)}V',
                    voltage=random.randint(10000, 14000),
                    temperature=random.randint(200, 350),
                    soc=random.randint(10, 100),
                    soh=random.randint(50, 100),
                    imp=random.randint(100, 150),
                    alert_time=now - timedelta(hours=random.randint(0, 12)),
                    acknowledged=random.choice([True, False]),
                )
                critical_count += 1
            
            # Random warning alert
            if random.random() > 0.8:
                BatteryAlert.objects.create(
                    id=str(uuid.uuid4()),
                    station=station,
                    battery_id=battery_id,
                    severity='warning',
                    message=f'Low state of charge: {random.randint(15, 30)}%',
                    voltage=random.randint(12000, 13000),
                    temperature=random.randint(250, 300),
                    soc=random.randint(10, 30),
                    soh=random.randint(70, 100),
                    imp=random.randint(100, 150),
                    alert_time=now - timedelta(hours=random.randint(0, 6)),
                    acknowledged=random.choice([True, False]),
                )
                warning_count += 1
    
    print(f"✓ Created {critical_count} critical alerts")
    print(f"✓ Created {warning_count} warning alerts")
    print("\n✅ Database seeded successfully!")

if __name__ == '__main__':
    seed_data()
