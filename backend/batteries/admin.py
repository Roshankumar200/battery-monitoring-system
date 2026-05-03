from django.contrib import admin
from .models import (
    BatteryStation,
    BatteryReading,
    BatteryAlert,
    BatteryStatistics,
    GlobalNotificationSettings,
    StationNotificationSettings,
    NotificationDeliveryLog,
)

@admin.register(BatteryStation)
class BatteryStationAdmin(admin.ModelAdmin):
    list_display = ("station_id", "name", "facility", "building", "mqtt_broker", "mqtt_topic", "is_active")
    search_fields = ("station_id", "name", "facility", "building")

@admin.register(BatteryReading)
class BatteryReadingAdmin(admin.ModelAdmin):
    list_display = ("station", "battery_id", "voltage", "temperature", "soc", "soh", "imp", "timestamp")
    list_filter = ("station", "battery_id")

@admin.register(BatteryAlert)
class BatteryAlertAdmin(admin.ModelAdmin):
    list_display = ("station", "battery_id", "severity", "message", "alert_time", "acknowledged")
    list_filter = ("severity", "station")

@admin.register(BatteryStatistics)
class BatteryStatisticsAdmin(admin.ModelAdmin):
    list_display = ("station", "battery_id", "date", "avg_voltage", "avg_temperature", "avg_soc", "avg_soh")
    list_filter = ("station", "battery_id", "date")


@admin.register(GlobalNotificationSettings)
class GlobalNotificationSettingsAdmin(admin.ModelAdmin):
    list_display = ("scope", "alert_email", "alert_phone", "email_enabled", "sms_enabled", "csv_enabled")
    search_fields = ("scope", "alert_email", "alert_phone", "csv_email")


@admin.register(StationNotificationSettings)
class StationNotificationSettingsAdmin(admin.ModelAdmin):
    list_display = ("station", "alert_email", "alert_phone", "email_enabled", "sms_enabled", "csv_enabled")
    list_filter = ("email_enabled", "sms_enabled", "csv_enabled")
    search_fields = ("station__station_id", "alert_email", "alert_phone", "csv_email")


@admin.register(NotificationDeliveryLog)
class NotificationDeliveryLogAdmin(admin.ModelAdmin):
    list_display = ("station", "channel", "recipient", "status", "provider", "created_at", "sent_at")
    list_filter = ("channel", "status", "provider")
    search_fields = ("station__station_id", "recipient", "subject", "message")
