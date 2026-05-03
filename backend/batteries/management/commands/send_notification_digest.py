from django.core.management.base import BaseCommand

from batteries.notifications import send_notification_digest_report


class Command(BaseCommand):
    help = 'Send hourly or all-time notification digest to Gmail and SMS recipients.'

    def add_arguments(self, parser):
        parser.add_argument('--mode', type=str, default='hourly', choices=['hourly', 'all'], help='Digest mode')
        parser.add_argument('--hours', type=int, default=1, help='Hourly window size when mode=hourly')

    def handle(self, *args, **options):
        mode = options['mode']
        hours = options['hours']

        result = send_notification_digest_report(mode=mode, hours=hours)
        sent = sum(1 for item in result['results'] if item['email_sent'] or item['sms_sent'])
        self.stdout.write(self.style.SUCCESS(f"Digest processed for {sent} station(s)."))