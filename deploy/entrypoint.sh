#!/bin/sh
# Entrypoint боевого контейнера: рендер конфига nginx и запуск gunicorn + nginx.
set -e

CERT_FILE="${TLS_CERT_FILE:-/etc/nginx/certs/fullchain.pem}"
KEY_FILE="${TLS_KEY_FILE:-/etc/nginx/certs/privkey.pem}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
SERVER_NAME="${SERVER_NAME:-_}"
GUNICORN_BIND="${GUNICORN_BIND:-127.0.0.1:8000}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "ERROR: TLS сертификаты не найдены." >&2
    echo "  сертификат: $CERT_FILE" >&2
    echo "  ключ:       $KEY_FILE" >&2
    echo "Смонтируйте их, например: -v /host/certs:/etc/nginx/certs:ro" >&2
    echo "и при необходимости задайте TLS_CERT_FILE / TLS_KEY_FILE." >&2
    exit 1
fi

export TLS_CERT_FILE="$CERT_FILE" TLS_KEY_FILE="$KEY_FILE" \
       HTTP_PORT HTTPS_PORT SERVER_NAME GUNICORN_BIND

mkdir -p /etc/nginx/conf.d /var/log/nginx /run/nginx

# Рендерим конфиг, подставляя только наши переменные (nginx-переменные $host и т.п. не трогаем)
envsubst '$SERVER_NAME $HTTP_PORT $HTTPS_PORT $TLS_CERT_FILE $TLS_KEY_FILE $GUNICORN_BIND' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

nginx -t

echo "Запуск gunicorn на ${GUNICORN_BIND} (${GUNICORN_WORKERS} воркеров)"
gunicorn \
    --workers "$GUNICORN_WORKERS" \
    --bind "$GUNICORN_BIND" \
    --access-logfile - \
    --error-logfile - \
    wsgi:app &
GUNICORN_PID=$!

# Корректно останавливаем gunicorn при остановке контейнера
trap 'kill "$GUNICORN_PID" 2>/dev/null || true' TERM INT

echo "Запуск nginx (HTTP ${HTTP_PORT} -> HTTPS ${HTTPS_PORT}, server_name ${SERVER_NAME})"
nginx -g 'daemon off;'
