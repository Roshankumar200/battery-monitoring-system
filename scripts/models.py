# Battery Monitoring Models - Django
from django.db import models
from django.utils import timezone
import uuid

class BatteryStation(models.Model):
    """Represents a physical battery monitoring station"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    # Optional aggregate location string (backward compatible)
    location = models.CharField(max_length=300, blank=True)
    facility = models.CharField(max_length=200, blank=True)
    building = models.CharField(max_length=200, blank=True)
    zone = models.CharField(max_length=200, blank=True)
    
    # MQTT Configuration
    mqtt_broker = models.CharField(max_length=255)
    mqtt_port = models.IntegerField(default=1883)
    mqtt_topic = models.CharField(max_length=255)
    mqtt_username = models.CharField(max_length=100, blank=True)
    mqtt_password = models.CharField(max_length=100, blank=True)
    
    # Limits
    voltage_min = models.IntegerField(default=11000)  # 11.0V in mV
    voltage_max = models.IntegerField(default=13500)  # 13.5V in mV
    temperature_min = models.IntegerField(default=0)  # 0°C in 0.1°C
    temperature_max = models.IntegerField(default=450)  # 45°C in 0.1°C
    soc_min = models.IntegerField(default=20)  # 20%
    soh_min = models.IntegerField(default=80)  # 80%
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['station_id']
    
    def __str__(self):
        return f"{self.station_id} - {self.name}"


class BatteryReading(models.Model):
    """Individual battery reading from MQTT"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey(BatteryStation, on_delete=models.CASCADE, related_name='readings')
    battery_id = models.CharField(max_length=50)
    
    # Battery Parameters
    voltage = models.IntegerField()  # mV (e.g., 12450)
    temperature = models.IntegerField()  # 0.1°C (e.g., 286 = 28.6°C)
    soc = models.IntegerField()  # State of Charge (0-100%)
    soh = models.IntegerField()  # State of Health (0-100%)
    imp = models.IntegerField()  # Impedance in mOhms (e.g., 125)
    
    # Timestamps
    timestamp = models.DateTimeField()  # Data collection time
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['station', '-timestamp']),
            models.Index(fields=['station', 'battery_id', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.station.station_id}/{self.battery_id} @ {self.timestamp}"


class BatteryAlert(models.Model):
    """Alert triggered by battery conditions"""
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey(BatteryStation, on_delete=models.CASCADE, related_name='alerts')
    battery_id = models.CharField(max_length=50)
    
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    message = models.TextField()
    
    # Alert Data
    voltage = models.IntegerField(null=True, blank=True)
    temperature = models.IntegerField(null=True, blank=True)
    soc = models.IntegerField(null=True, blank=True)
    soh = models.IntegerField(null=True, blank=True)
    imp = models.IntegerField(null=True, blank=True)
    
    # Status
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    alert_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['station', '-created_at']),
            models.Index(fields=['severity', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.severity.upper()}: {self.station.station_id}/{self.battery_id}"


class BatteryStatistics(models.Model):
    """Aggregated statistics for battery performance"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey(BatteryStation, on_delete=models.CASCADE, related_name='statistics')
    battery_id = models.CharField(max_length=50)
    
    date = models.DateField()
    
    # Statistics
    avg_voltage = models.FloatField()
    min_voltage = models.IntegerField()
    max_voltage = models.IntegerField()
    
    avg_temperature = models.FloatField()
    min_temperature = models.IntegerField()
    max_temperature = models.IntegerField()
    
    avg_soc = models.FloatField()
    min_soc = models.IntegerField()
    max_soc = models.IntegerField()
    
    avg_soh = models.FloatField()
    min_soh = models.IntegerField()
    max_soh = models.IntegerField()
    
    alert_count = models.IntegerField(default=0)
    critical_alerts = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['station', 'battery_id', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.station.station_id}/{self.battery_id} - {self.date}"
