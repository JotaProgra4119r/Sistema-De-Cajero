# Dockerfile Todo-en-Uno (All-In-One Kiosk) basado en Debian Bookworm
# Permite correr Backend + Frontend con un solo comando: "Instalar y Abrir"
FROM python:3.12-slim-bookworm

WORKDIR /app

# 1. Instalar paquetes de sistema Debian (NodeJS 22, Nginx, curl, gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    gcc \
    nginx \
    pkg-config \
    default-libmysqlclient-dev \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Compilar Frontend React
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build && cp -r dist/* /var/www/html/

# 4. Copiar código backend, base de datos y sensores
COPY backend/ ./backend/
COPY database/ ./database/
COPY sensors/ ./sensors/
COPY data/ ./data/
COPY instalacion/nginx.conf /etc/nginx/sites-available/default

# 5. Configuración de Supervisor para arranque simultáneo de Nginx + Uvicorn
RUN echo "[supervisord]\nnodaemon=true\n\n[program:nginx]\ncommand=nginx -g 'daemon off;'\nautostart=true\nautorestart=true\n\n[program:backend]\ncommand=python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000\ndirectory=/app\nautostart=true\nautorestart=true\n" > /etc/supervisor/conf.d/supervisord.conf

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    MOCK_HARDWARE=True

EXPOSE 80 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
