"""
Simple MQTT publisher for testing the battery consumer.
Usage (PowerShell):
    python ./scripts/mqtt_test/publish_test.py --station STN-01 --count 12 --interval 1

Environment variables (optional):
    MQTT_BROKER_HOST (default: localhost)
    MQTT_BROKER_PORT (default: 1883)
    MQTT_USERNAME / MQTT_PASSWORD (optional)

This script publishes to topic: /batteries/{station}/data
Payload format matches the consumer expectations:
{
    "station_id": "STN-01",
    "timestamp": "2025-11-05T12:34:56Z",
    "batteries": [ { "battery_id": "BAT-01", "V": 3700, "T": 250, "SOC": 85, "SOH": 98, "IMP": 35 }, ... ]
}
"""
import os
import time
import json
import random
import argparse
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

DEFAULT_BATTERIES = [f"BAT-{i:02d}" for i in range(1, 13)]


def make_payload(station_id, battery_ids):
    now = datetime.now(timezone.utc).isoformat()
    batteries = []
    for i, b in enumerate(battery_ids):
        # V in mV, T in 0.1°C, SOC and SOH as percent (0-100), IMP in mOhm
        v = random.randint(3200, 4200)
        t = random.randint(180, 350)  # 18.0°C - 35.0°C (0.1°C units)
        soc = random.randint(20, 100)
        soh = random.randint(80, 100)
        imp = random.randint(20, 120)
        batteries.append({
            "battery_id": b,
            "V": v,
            "T": t,
            "SOC": soc,
            "SOH": soh,
            "IMP": imp,
        })
    return {"station_id": station_id, "timestamp": now, "batteries": batteries}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--station", required=True, help="station id (topic part)")
    parser.add_argument("--count", type=int, default=1, help="how many messages to send")
    parser.add_argument("--interval", type=float, default=0.5, help="seconds between messages")
    parser.add_argument("--batteries", type=int, default=12, help="number of batteries to include")
    args = parser.parse_args()

    host = os.getenv("MQTT_BROKER_HOST", "localhost")
    port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    username = os.getenv("MQTT_USERNAME")
    password = os.getenv("MQTT_PASSWORD")

    client = mqtt.Client()
    if username:
        client.username_pw_set(username, password)
    client.connect(host, port)

    topic = f"/batteries/{args.station}/data"
    battery_ids = [f"BAT-{i+1:02d}" for i in range(args.batteries)]

    for i in range(args.count):
        payload = make_payload(args.station, battery_ids)
        payload_json = json.dumps(payload)
        client.publish(topic, payload_json)
        print(f"Published message {i+1}/{args.count} to {topic}")
        time.sleep(args.interval)

    client.disconnect()


if __name__ == "__main__":
    main()
