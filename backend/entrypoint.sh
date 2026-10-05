#!/bin/sh
set -e

# Wait for PostgreSQL if DATABASE_URL is set to postgres
if echo "$DATABASE_URL" | grep -q "postgres"; then
    echo "Waiting for PostgreSQL database..."
    while ! python -c "
import sys, os, dj_database_url, psycopg2
db_url = os.environ.get('DATABASE_URL', '')
cfg = dj_database_url.parse(db_url)
try:
    conn = psycopg2.connect(
        dbname=cfg['NAME'],
        user=cfg['USER'],
        password=cfg['PASSWORD'],
        host=cfg['HOST'],
        port=cfg['PORT']
    )
    conn.close()
    sys.exit(0)
except Exception as e:
    sys.exit(1)
" 2>/dev/null; do
        sleep 1
    done
    echo "PostgreSQL is ready!"
fi

# Run database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Execute the main container command
echo "Starting application with: $@"
exec "$@"
