from django.core.management.base import BaseCommand
from batteries.models import BatteryStation
from batteries.mqtt_client import MQTTClient
import threading

class Command(BaseCommand):
    help = 'Start MQTT client for battery monitoring - connects to all active stations'

    def handle(self, *args, **options):
        # Get all active battery stations
        stations = BatteryStation.objects.filter(is_active=True)
        
        if not stations.exists():
            self.stdout.write(self.style.ERROR('No active battery stations found!'))
            self.stdout.write('Please create a BatteryStation in Django admin with MQTT credentials.')
            return

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("MQTT Consumer Starting..."))
        self.stdout.write("="*70)
        
        clients = []
        for station in stations:
            self.stdout.write(f"\nStation: {station.station_id} - {station.name}")
            self.stdout.write(f"  Broker: {station.mqtt_broker}:{station.mqtt_port}")
            self.stdout.write(f"  Topic: {station.mqtt_topic}")
            self.stdout.write(f"  Username: {station.mqtt_username if station.mqtt_username else '(none)'}")
            self.stdout.write(f"  Password: {'***' if station.mqtt_password else '(none)'}")
            
            try:
                client = MQTTClient(
                    station.mqtt_broker,
                    station.mqtt_port,
                    station.mqtt_username,
                    station.mqtt_password
                )
                client.connect_and_subscribe(station.mqtt_topic)
                clients.append(client)
                self.stdout.write(self.style.SUCCESS(f"  ✓ Connected and subscribed"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ✗ Failed: {e}"))

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS(f'✓ Connected to {len(clients)} station(s)'))
        self.stdout.write('Waiting for messages... (Press Ctrl+C to stop)')
        self.stdout.write("="*70 + "\n")
        
        try:
            while True:
                pass
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nStopping MQTT client...'))
