from django.contrib import admin
from django.urls import include, path
from rest_framework import routers
from rest_framework.authtoken.views import obtain_auth_token
from batteries.views import (
    BatteryStationViewSet,
    BatteryReadingViewSet,
    BatteryAlertViewSet,
    global_notification_settings,
    send_notification_digest,
    station_notification_settings,
)

router = routers.DefaultRouter()
router.register(r'stations', BatteryStationViewSet, basename='station')
router.register(r'batteries', BatteryReadingViewSet, basename='battery')
router.register(r'alerts', BatteryAlertViewSet, basename='alerts')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/notification-settings/global/', global_notification_settings, name='global-notification-settings'),
    path('api/notifications/digest/', send_notification_digest, name='notification-digest'),
    path('api/stations/<str:station_id>/notification-settings/', station_notification_settings, name='station-notification-settings'),
    path('api/auth/token/', obtain_auth_token, name='api-token-auth'),
]
