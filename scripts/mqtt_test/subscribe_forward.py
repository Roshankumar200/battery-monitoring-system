"""
Subscribe to /batteries/+/data and forward incoming messages to the Django backend API.
Usage (PowerShell):
  python ./scripts/mqtt_test/subscribe_forward.py

Environment variables (optional):
  MQTT_BROKER_HOST (default: localhost)
  MQTT_BROKER_PORT (default: 1883)
  BACKEND_URL (default: http://localhost:8000)
  MQTT_USERNAME / MQTT_PASSWORD (optional)

This script prints received MQTT payloads and POSTs them to BACKEND_URL + /api/batteries/
(That endpoint is documented in the repo and is used to accept readings from MQTT.)
"""
import os
import json
import time
import requests
import paho.mqtt.client as mqtt

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USERNAME")
MQTT_PASS = os.getenv("MQTT_PASSWORD")

TARGET_POST = BACKEND_URL + "/api/batteries/"
TOPIC = "/batteries/+/data"


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT broker {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(TOPIC)
        print(f"Subscribed to topic: {TOPIC}")
    else:
        print("MQTT connect failed, rc=", rc)


def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8")
    print("\n---- Received MQTT message ----")
    print(f"Topic: {msg.topic}")
    print(payload)

    # Try to forward to Django API
    try:
        data = json.loads(payload)
    except Exception as e:
        print("Payload is not JSON, skipping POST: ", e)
        return

    try:
        r = requests.post(TARGET_POST, json=data, timeout=5)
        if r.status_code in (200, 201):
            print(f"Forwarded to {TARGET_POST} -> {r.status_code}")
        else:
            print(f"Backend POST returned status {r.status_code}: {r.text}")
    except Exception as e:
        print("Failed to POST to backend:", e)


def main():
    client = mqtt.Client()
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(MQTT_HOST, MQTT_PORT)
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("Exiting...")
        client.disconnect()


if __name__ == "__main__":
    print("Starting subscribe_forward (broker=%s:%d, backend=%s)" % (MQTT_HOST, MQTT_PORT, BACKEND_URL))
    main()
