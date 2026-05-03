from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Max
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from .models import BatteryStation, BatteryReading, BatteryAlert, GlobalNotificationSettings, StationNotificationSettings
from .serializers import (
    BatteryStationSerializer,
    BatteryReadingSerializer,
    BatteryAlertSerializer,
    GlobalNotificationSettingsSerializer,
    StationNotificationSettingsSerializer,
)
from .notifications import send_notification_digest_report

class BatteryStationViewSet(viewsets.ModelViewSet):
    queryset = BatteryStation.objects.all()
    serializer_class = BatteryStationSerializer
    lookup_field = 'station_id'
    pagination_class = None  # Stations are a small set — no pagination needed

    @action(detail=True, methods=['get', 'put', 'patch'])
    def thresholds(self, request, station_id=None):
        """GET/PUT thresholds for a specific station."""
        station = self.get_object()
        if request.method == 'GET':
            return Response({
                'station_id': station.station_id,
                'voltage_min': station.voltage_min,
                'voltage_max': station.voltage_max,
                'temperature_min': station.temperature_min,
                'temperature_max': station.temperature_max,
                'soc_min': station.soc_min,
                'soh_min': station.soh_min,
                'imp_max': station.imp_max,
            })
        # PUT / PATCH
        threshold_fields = [
            'voltage_min', 'voltage_max', 'temperature_min', 'temperature_max',
            'soc_min', 'soh_min', 'imp_max',
        ]
        for field in threshold_fields:
            if field in request.data:
                setattr(station, field, int(request.data[field]))
        station.save(update_fields=[f for f in threshold_fields if f in request.data] + ['updated_at'])
        return Response({
            'station_id': station.station_id,
            'voltage_min': station.voltage_min,
            'voltage_max': station.voltage_max,
            'temperature_min': station.temperature_min,
            'temperature_max': station.temperature_max,
            'soc_min': station.soc_min,
            'soh_min': station.soh_min,
            'imp_max': station.imp_max,
        })


class BatteryReadingViewSet(viewsets.ModelViewSet):
    serializer_class = BatteryReadingSerializer
    queryset = BatteryReading.objects.select_related('station').all()

    def get_queryset(self):
        """Return only the latest reading for each battery"""
        station_id = self.request.query_params.get('station_id')
        battery_id = self.request.query_params.get('battery_id')
        
        qs = BatteryReading.objects.select_related('station').all()
        
        if station_id:
            qs = qs.filter(station__station_id=station_id)
        if battery_id:
            qs = qs.filter(battery_id=battery_id)
        
        # Get the latest timestamp for each battery
        latest_readings = qs.values('station_id', 'battery_id').annotate(
            latest_timestamp=Max('timestamp')
        )
        
        # Get the actual reading records for those latest timestamps
        latest_ids = []
        for reading in latest_readings:
            latest = qs.filter(
                station_id=reading['station_id'],
                battery_id=reading['battery_id'],
                timestamp=reading['latest_timestamp']
            ).first()
            if latest:
                latest_ids.append(latest.id)
        
        return BatteryReading.objects.filter(id__in=latest_ids).order_by('battery_id')

    # Override pagination for the latest-batteries list endpoint (no pagination needed there)
    def get_paginated_response(self, data):
        return Response(data)

    def paginate_queryset(self, queryset):
        # For the default list action, skip pagination (returns latest per battery — small set)
        if self.action == 'list':
            return None
        return super().paginate_queryset(queryset)

    @action(detail=False, methods=['get'])
    def history(self, request):
        station_id = request.query_params.get('station_id')
        battery_id = request.query_params.get('battery_id')
        limit = int(request.query_params.get('limit', '100'))
        qs = BatteryReading.objects.select_related('station').all()
        if station_id:
            qs = qs.filter(station__station_id=station_id)
        if battery_id:
            qs = qs.filter(battery_id=battery_id)
        qs = qs.order_by('-timestamp')[:limit]
        return Response(BatteryReadingSerializer(qs, many=True).data)

class BatteryAlertViewSet(viewsets.ModelViewSet):
    serializer_class = BatteryAlertSerializer
    queryset = BatteryAlert.objects.select_related('station').all()
    # Pagination is inherited from global PAGE_SIZE=50

    def get_queryset(self):
        qs = super().get_queryset()
        severity = self.request.query_params.get('severity')
        station_id = self.request.query_params.get('station_id')
        if severity:
            qs = qs.filter(severity=severity)
        if station_id:
            qs = qs.filter(station__station_id=station_id)
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Mark an alert as acknowledged."""
        alert = self.get_object()
        alert.acknowledged = True
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.data.get('acknowledged_by', request.user.username if request.user.is_authenticated else 'system')
        alert.save(update_fields=['acknowledged', 'acknowledged_at', 'acknowledged_by'])
        return Response(BatteryAlertSerializer(alert).data)

    @action(detail=False, methods=['post'])
    def acknowledge_bulk(self, request):
        """Bulk-acknowledge alerts by list of IDs."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'No alert ids provided.'}, status=status.HTTP_400_BAD_REQUEST)
        by = request.data.get('acknowledged_by', request.user.username if request.user.is_authenticated else 'system')
        updated = BatteryAlert.objects.filter(id__in=ids, acknowledged=False).update(
            acknowledged=True,
            acknowledged_at=timezone.now(),
            acknowledged_by=by,
        )
        return Response({'acknowledged': updated})


@api_view(['GET', 'PUT', 'PATCH'])
def global_notification_settings(request):
    settings_obj, _ = GlobalNotificationSettings.objects.get_or_create(scope='global')
    if request.method == 'GET':
        return Response(GlobalNotificationSettingsSerializer(settings_obj).data)

    serializer = GlobalNotificationSettingsSerializer(
        settings_obj,
        data=request.data,
        partial=request.method == 'PATCH',
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'PUT', 'PATCH'])
def station_notification_settings(request, station_id):
    station = get_object_or_404(BatteryStation, station_id=station_id)
    settings_obj, _ = StationNotificationSettings.objects.get_or_create(station=station)
    if request.method == 'GET':
        return Response(StationNotificationSettingsSerializer(settings_obj).data)

    serializer = StationNotificationSettingsSerializer(
        settings_obj,
        data=request.data,
        partial=request.method == 'PATCH',
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def send_notification_digest(request):
    mode = str(request.data.get('mode', 'all')).lower()
    station_id = request.data.get('station_id')
    hours = request.data.get('hours')

    station = None
    if station_id:
        station = get_object_or_404(BatteryStation, station_id=station_id)

    interval_hours = settings.NOTIFICATION_DIGEST_INTERVAL_HOURS
    if hours is not None:
        try:
            interval_hours = max(1, int(hours))
        except (TypeError, ValueError):
            interval_hours = settings.NOTIFICATION_DIGEST_INTERVAL_HOURS

    result = send_notification_digest_report(
        mode='all' if mode == 'all' else 'hourly',
        hours=interval_hours,
        station=station,
    )
    return Response(result)
