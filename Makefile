.PHONY: help dev dev-backend dev-frontend docker-up docker-down clean

help:
	@echo "Sid Monitoring - Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make dev            - Start all development services"
	@echo "  make dev-backend    - Start backend only (requires ClickHouse)"
	@echo "  make dev-frontend   - Start frontend only"
	@echo "  make docker-up      - Start Docker Compose stack"
	@echo "  make docker-down    - Stop Docker Compose stack"
	@echo "  make clickhouse     - Start ClickHouse for local development"
	@echo "  make clean          - Clean build artifacts"

# Start ClickHouse for local development
clickhouse:
	docker-compose -f docker-compose.dev.yml up -d

# Start backend development server
dev-backend:
	cd backend && python run.py

# Start frontend development server
dev-frontend:
	cd frontend && npm run dev

# Start all development services
dev:
	@echo "Starting ClickHouse..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Waiting for ClickHouse to be ready..."
	@sleep 5
	@echo ""
	@echo "Start backend and frontend in separate terminals:"
	@echo "  Terminal 1: make dev-backend"
	@echo "  Terminal 2: make dev-frontend"

# Production Docker Compose
docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down

# Clean artifacts
clean:
	rm -rf frontend/node_modules frontend/dist
	rm -rf backend/__pycache__ backend/.pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

# Install dependencies
install:
	cd frontend && npm install
	cd backend && pip install -r requirements.txt

# Build for production
build:
	cd frontend && npm run build
