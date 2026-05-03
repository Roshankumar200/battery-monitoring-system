"""
Simple MQTT connection test script
Run this to verify your MQTT broker credentials are working
"""
import os
import time
import paho.mqtt.client as mqtt

# Get credentials from environment variables
BROKER = os.getenv('MQTT_BROKER_HOST', 'localhost')
PORT = int(os.getenv('MQTT_BROKER_PORT', '1883'))
TOPIC = os.getenv('MQTT_TOPIC', '/batteries/+/data')
USERNAME = os.getenv('MQTT_USERNAME', '')
PASSWORD = os.getenv('MQTT_PASSWORD', '')

print("="*60)
print("MQTT Connection Test")
print("="*60)
print(f"Broker: {BROKER}:{PORT}")
print(f"Topic: {TOPIC}")
print(f"Username: {USERNAME if USERNAME else '(none)'}")
print(f"Password: {'***' if PASSWORD else '(none)'}")
print("="*60)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✓ Connected successfully!")
        print(f"✓ Subscribing to topic: {TOPIC}")
        client.subscribe(TOPIC)
        print("✓ Subscribed - waiting for messages...")
        print("  (Press Ctrl+C to stop)")
    else:
        print(f"✗ Connection failed with code {rc}")
        if rc == 1:
            print("  Error: Incorrect protocol version")
        elif rc == 2:
            print("  Error: Invalid client identifier")
        elif rc == 3:
            print("  Error: Server unavailable")
        elif rc == 4:
            print("  Error: Bad username or password")
        elif rc == 5:
            print("  Error: Not authorized")

def on_message(client, userdata, msg):
    print("\n" + "="*60)
    print(f"✓ MESSAGE RECEIVED!")
    print("="*60)
    print(f"Topic: {msg.topic}")
    print(f"Payload: {msg.payload.decode('utf-8')}")
    print("="*60 + "\n")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"\n✗ Unexpected disconnect (code {rc})")

# Create client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.on_disconnect = on_disconnect

# Set credentials if provided
if USERNAME or PASSWORD:
    client.username_pw_set(USERNAME, PASSWORD)

# Try to connect
try:
    print("\nConnecting to broker...")
    client.connect(BROKER, PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("\n\nStopping...")
    client.disconnect()
except Exception as e:
    print(f"\n✗ Connection error: {e}")
    print("\nTroubleshooting:")
    print("1. Check broker address and port are correct")
    print("2. Verify broker is running and accessible")
    print("3. Check username/password if authentication is required")
    print("4. Verify firewall allows connection to the broker")
