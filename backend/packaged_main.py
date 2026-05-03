"""Packaged backend entrypoint for a frozen Windows build.

This module is intended to be frozen into a backend executable that can be
launched by a single top-level app launcher. It bootstraps Django, applies
migrations on first launch, and starts a production WSGI server when available.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path


def _truthy(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _configure_runtime() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    os.environ.setdefault("BMS_PACKAGED_MODE", "1")

    if not os.getenv("BMS_DATA_DIR"):
        local_app_data = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
        data_dir = Path(local_app_data) / "G3_BMS" if local_app_data else Path.home() / ".g3_bms"
        data_dir.mkdir(parents=True, exist_ok=True)
        os.environ["BMS_DATA_DIR"] = str(data_dir)


def _apply_startup_migrations() -> None:
    from django.core.management import call_command

    if _truthy(os.getenv("BMS_RUN_MIGRATIONS"), True):
        call_command("migrate", interactive=False, verbosity=1)


def _start_background_services() -> None:
    if not _truthy(os.getenv("MQTT_AUTOSTART"), True):
        return

    from batteries.apps import start_mqtt_consumers

    start_mqtt_consumers()


def main() -> None:
    _configure_runtime()

    import django

    django.setup()

    logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    _apply_startup_migrations()
    _start_background_services()

    host = os.getenv("BMS_HOST", "127.0.0.1")
    port = int(os.getenv("BMS_PORT", "8000"))

    try:
        from waitress import serve
        from config.wsgi import application

        logging.getLogger(__name__).info("Starting packaged backend on http://%s:%s", host, port)
        serve(application, host=host, port=port, threads=int(os.getenv("BMS_THREADS", "4")))
    except Exception:
        from django.core.management import execute_from_command_line

        logging.getLogger(__name__).warning("waitress is unavailable; falling back to Django runserver.")
        execute_from_command_line([sys.argv[0], "runserver", f"{host}:{port}"])


if __name__ == "__main__":
    main()