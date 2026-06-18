from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# Helper to strip quotes from boolean strings
def config_bool(name, default=False):
    val = str(config(name, default=default)).strip('"\' ').lower()
    return val in ('true', '1', 'yes', 'on')

# Helper to strip quotes from list strings
def config_list(name, default=''):
    raw = str(config(name, default=default)).strip('"\' ')
    return [item.strip('"\' ') for item in raw.split(',') if item.strip('"\' ')]

SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-in-production').strip('"\' ')
DEBUG = config_bool('DEBUG', default=True)
ALLOWED_HOSTS = config_list('ALLOWED_HOSTS', default='*')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'trips',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
}

# CORS
CORS_ALLOWED_ORIGINS = config_list('CORS_ALLOWED_ORIGINS', default='http://localhost:5173')
CORS_ALLOW_ALL_ORIGINS = config_bool('CORS_ALLOW_ALL_ORIGINS', default=False)

# External API timeouts
OSRM_BASE_URL = 'http://router.project-osrm.org'
NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
