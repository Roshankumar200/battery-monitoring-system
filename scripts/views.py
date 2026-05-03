# Django REST Framework viewsets for battery monitoring
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from .models import BatteryStation, BatteryReading, BatteryAlert
from .serializers import BatteryStationSerializer, BatteryReadingSerializer, BatteryAlertSerializer

class BatteryStationViewSet(viewsets.ModelViewSet):
    queryset = BatteryStation.objects.all()
    serializer_class = BatteryStationSerializer
    lookup_field = 'station_id'

class BatteryReadingViewSet(viewsets.ModelViewSet):
    serializer_class = BatteryReadingSerializer
    queryset = BatteryReading.objects.select_related('station').all()

    def get_queryset(self):
        qs = super().get_queryset()
        station_id = self.request.query_params.get('station_id')
        battery_id = self.request.query_params.get('battery_id')
        if station_id:
            qs = qs.filter(station__station_id=station_id)
        if battery_id:
            qs = qs.filter(battery_id=battery_id)
        return qs.order_by('-timestamp')[:1000]

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

    def get_queryset(self):
        qs = super().get_queryset()
        severity = self.request.query_params.get('severity')
        station_id = self.request.query_params.get('station_id')
        if severity:
            qs = qs.filter(severity=severity)
        if station_id:
            qs = qs.filter(station__station_id=station_id)
        return qs.order_by('-created_at')
