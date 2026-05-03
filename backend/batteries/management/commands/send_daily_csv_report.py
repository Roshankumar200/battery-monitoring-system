from datetime import date as date_cls

from django.core.management.base import BaseCommand

from batteries.models import BatteryStation
from batteries.notifications import send_daily_csv_report


class Command(BaseCommand):
    help = 'Send daily CSV battery report for all active stations or a single station.'

    def add_arguments(self, parser):
        parser.add_argument('--station-id', type=str, default=None, help='Optional station_id filter')
        parser.add_argument('--date', type=str, default=None, help='Optional report date in YYYY-MM-DD format')

    def handle(self, *args, **options):
        station_id = options['station_id']
        report_date = options['date']

        station = None
        if station_id:
            try:
                station = BatteryStation.objects.get(station_id=station_id)
            except BatteryStation.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Station not found: {station_id}'))
                return

        if report_date:
            year, month, day = map(int, report_date.split('-'))
            report_date = date_cls(year, month, day)

        send_daily_csv_report(station=station, report_date=report_date)
        self.stdout.write(self.style.SUCCESS('Daily CSV report sent.'))
