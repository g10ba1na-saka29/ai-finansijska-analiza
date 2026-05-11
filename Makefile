.PHONY: up dev down build migrate logs ps shell-api shell-db clean

# Pokreni sve servise (production build)
up:
	docker compose up -d

# Pokreni i rebuilda slike (production)
up-build:
	docker compose up -d --build

# DEV mod — frontend hot reload, bez rebuilda
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Zaustavi sve
down:
	docker compose down

# Zaustavi i obrisi volumene (reset baze)
down-v:
	docker compose down -v

# Build slika (bez pokretanja)
build:
	docker compose build

# Pokreni Alembic migracije
migrate:
	docker compose --profile migrate run --rm migrate

# Logs (svi servisi, zadnjih 100 linija)
logs:
	docker compose logs -f --tail=100

# Logs za specifičan servis: make logs-api
logs-api:
	docker compose logs -f --tail=100 api

logs-worker:
	docker compose logs -f --tail=100 worker

logs-frontend:
	docker compose logs -f --tail=100 frontend

# Status servisa
ps:
	docker compose ps

# Shell u API kontejner
shell-api:
	docker compose exec api bash

# psql shell
shell-db:
	docker compose exec db psql -U finuser -d finanaliza

# Obrisi sve Docker resurse projekta
clean:
	docker compose down -v --rmi local
