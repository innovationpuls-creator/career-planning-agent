#!/usr/bin/env bash
# ============================================
# Career Planning Agent - One-Click Start
# ============================================
# Usage: bash deploy/start.sh
# Requirements: Docker & Docker Compose v2
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "============================================"
echo " Career Planning Agent - Deployment"
echo "============================================"

# ---- Check prerequisites ----
if ! command -v docker &>/dev/null; then
    echo "[ERROR] Docker not found. Install Docker first."
    echo "  curl -fsSL https://get.docker.com | bash"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo "[ERROR] Docker Compose v2 not found."
    echo "  Install: sudo apt-get install docker-compose-plugin"
    exit 1
fi

# ---- Check .env ----
if [ ! -f .env ]; then
    if [ -f deploy/.env.example ]; then
        echo "[INFO] Creating .env from deploy/.env.example ..."
        cp deploy/.env.example .env
        echo "[WARN] Edit .env and set APP_SECRET_KEY before starting!"
        echo "  Run: nano .env"
        exit 1
    else
        echo "[ERROR] deploy/.env.example not found."
        exit 1
    fi
fi

# ---- Validate APP_SECRET_KEY ----
APP_SECRET_KEY=$(grep -E '^APP_SECRET_KEY=' .env 2>/dev/null | cut -d '=' -f2 || echo "")
if [ -z "$APP_SECRET_KEY" ] || [ "$APP_SECRET_KEY" = "replace-with-a-long-random-secret-at-least-32-chars" ]; then
    echo "[ERROR] APP_SECRET_KEY is not set or still has the default value!"
    echo "  Generate one: openssl rand -hex 32"
    echo "  Edit .env and set APP_SECRET_KEY=<your-key>"
    exit 1
fi

echo "[INFO] Building and starting containers ..."
echo "[INFO] This may take a few minutes on first run."
echo ""

# ---- Build and start ----
docker compose up -d --build

echo ""
echo "============================================"
echo " Deployment Complete!"
echo "============================================"
echo ""
echo " Access the application:"
echo "   http://$(grep -E '^APP_DOMAIN=' .env 2>/dev/null | cut -d '=' -f2 || echo 'localhost')"
echo ""
echo " Useful commands:"
echo "   docker compose logs -f        # View all logs"
echo "   docker compose logs backend   # Backend logs only"
echo "   docker compose ps             # Container status"
echo "   docker compose down           # Stop all containers"
echo "   docker compose restart        # Restart all containers"
echo ""
echo " Health check:"
echo "   curl http://localhost/api/"
echo ""

# Print container status
docker compose ps
