.PHONY: up down logs restart audit test build ps

up:
	docker compose up --build -d

down:
	docker compose down -v

logs:
	docker compose logs -f stream-processor backend

restart:
	docker compose restart stream-processor backend

ps:
	docker compose ps

# Runs the ACID concurrency audit against the running stack.
audit:
	docker compose exec stream-processor python acid_audit.py --workers 8 --rows-per-worker 500

# Runs the offline unit tests (rules engine + circuit breaker logic).
test:
	cd stream_processor && python -m pytest tests/ -v || python tests/test_rules_engine.py && python tests/test_circuit_breaker.py

build:
	docker compose build
