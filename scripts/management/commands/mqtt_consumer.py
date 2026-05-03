"""
Deprecated duplicate management command.

Note: The actual Django management command for running the MQTT consumer
exists under backend/batteries/management/commands/mqtt_consumer.py.
This placeholder avoids import resolution errors in editors and CI by
intentionally not importing Django or project modules from this scripts path.

To run the consumer, use:
  cd backend
  python manage.py mqtt_consumer
"""

# Intentionally left empty.
