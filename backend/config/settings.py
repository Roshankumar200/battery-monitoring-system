import os
import sys
import importlib.util
import django.utils.translation as _trans
import django.utils.encoding as _enc

# Backward-compat alias for third-party apps using deprecated ugettext_lazy
try:
    getattr(_trans, 'ugettext_lazy')
except AttributeError:  # Django 4 removed ugettext_lazy
    from django.utils.translation import gettext_lazy as _gettext_lazy
    _trans.ugettext_lazy = _gettext_lazy  # type: ignore[attr-defined]

# Backward-compat alias for force_text removed in Django 4
try:
    getattr(_enc, 'force_text')
except AttributeError:
    from django.utils.encoding import force_str as _force_str
    _enc.force_text = _force_str  # type: ignore[attr-defined]

from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


def _is_packaged_runtime() -> bool:
    return bool(getattr(sys, "frozen", False) or os.getenv("BMS_PACKAGED_MODE", "0") in {"1", "true", "TRUE", "yes", "YES"})


def _runtime_data_dir() -> Path:
    override_dir = os.getenv("BMS_DATA_DIR", "").strip()
    if override_dir:
        return Path(override_dir).expanduser()

    local_app_data = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
    if local_app_data:
        return Path(local_app_data) / "G3_BMS"

    return Path.home() / ".g3_bms"


def _load_env_file() -> None:
    env_candidates = []
    if _is_packaged_runtime():
        executable_dir = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else BASE_DIR
        env_candidates.extend([executable_dir / ".env", _runtime_data_dir() / ".env"])
    else:
        env_candidates.append(BASE_DIR / ".env")

    for env_path in env_candidates:
        if env_path.exists():
            load_dotenv(env_path)


RUNTIME_DIR = _runtime_data_dir() if _is_packaged_runtime() else BASE_DIR
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
_load_env_file()

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = os.getenv('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = [host.strip() for host in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,::1').split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'batteries',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ─── Database ──────────────────────────────────────────────────────────────────
# Default to PostgreSQL when DB_ENGINE is set in .env; fall back to SQLite in dev.
_db_engine = os.getenv('DB_ENGINE', '')
if _db_engine and _db_engine != 'django.db.backends.sqlite3':
    DATABASES = {
        'default': {
            'ENGINE': _db_engine,
            'NAME': os.getenv('DB_NAME', 'g3_bms'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }
else:
    default_sqlite_path = RUNTIME_DIR / 'db.sqlite3'
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': Path(os.getenv('DB_PATH', str(default_sqlite_path))),
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('DJANGO_TIME_ZONE', 'Asia/Kolkata')
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = Path(os.getenv('STATIC_ROOT', str(RUNTIME_DIR / 'staticfiles')))
MEDIA_ROOT = Path(os.getenv('MEDIA_ROOT', str(RUNTIME_DIR / 'media')))
STATIC_ROOT.mkdir(parents=True, exist_ok=True)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── CORS ──────────────────────────────────────────────────────────────────────
_cors_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in _cors_env.split(',') if o.strip()
] if _cors_env else [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
]
CORS_ALLOW_CREDENTIALS = True

# In development, allow all origins to avoid port-mismatch issues
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

# ─── REST Framework & Authentication ──────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated'
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# In development with DEBUG=True, keep AllowAny for convenience
if DEBUG:
    REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = [
        'rest_framework.permissions.AllowAny'
    ]

# ── Logging ─────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'batteries.mqtt': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'batteries.notifications': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# MQTT settings (env overridable)
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', '1883'))
MQTT_BROKER_USERNAME = os.getenv('MQTT_BROKER_USERNAME', '')
MQTT_BROKER_PASSWORD = os.getenv('MQTT_BROKER_PASSWORD', '')
MQTT_TOPIC = os.getenv('MQTT_TOPIC', '/batteries/+/data')

# Email notification settings (Gmail SMTP by default)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', '1') in {'1', 'true', 'TRUE', 'yes', 'YES'}
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', '0') in {'1', 'true', 'TRUE', 'yes', 'YES'}
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', os.getenv('GMAIL_ADDRESS', ''))
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', os.getenv('GMAIL_APP_PASSWORD', ''))
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'noreply@gmail.com')

# Notification digest cadence
NOTIFICATION_DIGEST_INTERVAL_HOURS = int(os.getenv('NOTIFICATION_DIGEST_INTERVAL_HOURS', '1'))

# SMS notification settings (Twilio)
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.getenv('TWILIO_FROM_NUMBER', '')

NOTIFICATION_TIMEZONE = os.getenv('NOTIFICATION_TIMEZONE', TIME_ZONE)
