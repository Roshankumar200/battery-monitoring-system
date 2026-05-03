import json
import random
from datetime import datetime
from django.core.management.base import BaseCommand, CommandParser
from django.conf import settings
import importlib.util


class Command(BaseCommand):
    help = "Publish a sample or provided battery payload to MQTT (topic: /batteries/{station_id}/data)"

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("station_id", type=str, help="Station ID, e.g. STN-01")
        parser.add_argument("--count", type=int, default=12, help="Number of batteries to include (default: 12)")
        parser.add_argument("--topic", type=str, default=None, help="Override topic (default: /batteries/{station_id}/data)")
        parser.add_argument("--payload", type=str, default=None, help="JSON string to send instead of a generated payload")

    def handle(self, *args, **options):
        station_id: str = options["station_id"]
        count: int = max(1, min(100, options["count"]))
        topic: str = options["topic"] or f"/batteries/{station_id}/data"
        payload_str: str | None = options["payload"]

        if payload_str is None:
            payload = self._generate_payload(station_id, count)
            payload_str = json.dumps(payload)

        use_django_mqtt = (
            importlib.util.find_spec("django_mqtt") is not None
            and getattr(settings, 'ENABLE_DJANGO_MQTT', False) in (True, '1', 1, 'true', 'TRUE')
        )
        if use_django_mqtt:
            self.stdout.write(self.style.NOTICE("Publishing via django_mqtt publisher…"))
            self._publish_via_django_mqtt(topic, payload_str)
        else:
            self.stdout.write(self.style.WARNING("django_mqtt not available; falling back to paho-mqtt"))
            self._publish_via_paho(topic, payload_str)

        self.stdout.write(self.style.SUCCESS(f"Published to {topic} ({len(payload_str)} bytes)"))

    def _generate_payload(self, station_id: str, n: int):
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        batteries = []
        base_v = 12450
        base_t = 286
        for i in range(1, n + 1):
            batteries.append({
                "battery_id": f"B{i:02d}",
                "V": base_v + random.randint(-120, 120),   # mV
                "T": base_t + random.randint(-20, 20),     # 0.1°C
                "SOC": max(10, min(100, 85 + random.randint(-30, 10))),
                "SOH": max(50, min(100, 95 + random.randint(-15, 0))),
                "IMP": max(80, min(260, 120 + random.randint(-30, 80))),
            })
        return {
            "station_id": station_id,
            "timestamp": now,
            "batteries": batteries,
        }

    def _publish_via_django_mqtt(self, topic: str, payload: str):
        # Import here to avoid static import errors when package not installed
        publisher_models = importlib.import_module('django_mqtt.publisher.models')
        core_models = importlib.import_module('django_mqtt.models')
        MqttServer = getattr(publisher_models, 'Server')
        MqttClient = getattr(publisher_models, 'Client')
        MqttData = getattr(publisher_models, 'Data')
        MqttTopic = getattr(core_models, 'Topic')

        host = getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
        port = int(getattr(settings, 'MQTT_BROKER_PORT', 1883))
        server, _ = MqttServer.objects.get_or_create(host=host, defaults={"port": port})
        if server.port != port:
            server.port = port
            server.save(update_fields=["port"])
        client, _ = MqttClient.objects.get_or_create(server=server)
        topic_obj, _ = MqttTopic.objects.get_or_create(name=topic)
        data = MqttData.objects.create(client=client, topic=topic_obj, payload=payload)
        data.update_remote()  # publish

    def _publish_via_paho(self, topic: str, payload: str):
        import paho.mqtt.client as mqtt
        host = getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
        port = int(getattr(settings, 'MQTT_BROKER_PORT', 1883))
        username = getattr(settings, 'MQTT_BROKER_USERNAME', '')
        password = getattr(settings, 'MQTT_BROKER_PASSWORD', '')

        client = mqtt.Client()
        if username or password:
            client.username_pw_set(username, password)
        client.connect(host, port, 60)
        client.publish(topic, payload)
        client.disconnect()
