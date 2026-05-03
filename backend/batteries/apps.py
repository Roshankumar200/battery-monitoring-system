from django.apps import AppConfig
import logging
import threading
import os

logger = logging.getLogger('batteries.mqtt')
MQTT_AUTOSTART = os.getenv('MQTT_AUTOSTART', '1') in {'1', 'true', 'TRUE', 'yes', 'YES'}


def start_mqtt_consumers():
    from .mqtt_client import MQTTClient
    from .models import BatteryStation

    try:
        stations = BatteryStation.objects.filter(is_active=True)
        if stations.exists():
            logger.info("=" * 70)
            logger.info("Starting MQTT Consumers...")
            logger.info("=" * 70)
            for station in stations:
                logger.info("Station: %s - %s", station.station_id, station.name)
                logger.info("  Broker: %s:%s", station.mqtt_broker, station.mqtt_port)
                logger.info("  Topic: %s", station.mqtt_topic)
                try:
                    client = MQTTClient(
                        station.mqtt_broker,
                        station.mqtt_port,
                        station.mqtt_username,
                        station.mqtt_password,
                        station_id=station.station_id,
                    )
                    client.connect_and_subscribe(station.mqtt_topic)
                    logger.info("  Connected and subscribed")
                except Exception as e:
                    logger.error("  Failed: %s", e)
            logger.info("=" * 70)
        else:
            logger.info("No active stations found — skipping MQTT consumers.")
    except Exception as e:
        logger.error("Error starting MQTT consumers: %s", e, exc_info=True)


class BatteriesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'batteries'

    def ready(self):
        if not MQTT_AUTOSTART:
            logger.info('MQTT autostart disabled by configuration.')
            return

        # Only start MQTT consumer in the main process (not in reloader child)
        if os.environ.get('RUN_MAIN') == 'true':
            # Start MQTT consumers in a background thread
            mqtt_thread = threading.Thread(target=start_mqtt_consumers, daemon=True)
            mqtt_thread.start()
