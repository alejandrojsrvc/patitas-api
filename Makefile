PNPM ?= pnpm
name ?=

.PHONY: help install bootstrap infra-up infra-down infra-status db-deploy db-status db-generate db-seed db-migrate check dev start stop restart status logs

help:
	@echo "Patitas API"
	@echo ""
	@echo "  make bootstrap             Instala, levanta Supabase local, migra y ejecuta el seed"
	@echo "  make infra-up              Inicia el stack local de Supabase"
	@echo "  make infra-down            Detiene el stack conservando los datos locales"
	@echo "  make infra-status          Muestra URLs locales sin exponer credenciales"
	@echo "  make db-deploy             Aplica migraciones pendientes"
	@echo "  make db-status             Comprueba el estado de las migraciones"
	@echo "  make db-migrate name=...   Crea una migración contra PostgreSQL local"
	@echo "  make db-seed               Carga datos descartables de desarrollo"
	@echo "  make check                 Ejecuta validaciones, tests y build"
	@echo "  make dev                   Inicia NestJS en modo watch (sin PM2)"
	@echo "  make start                 Levanta este proceso con PM2 (modo dev)"
	@echo "  make stop                  Detiene este proceso en PM2"
	@echo "  make restart               Reinicia este proceso en PM2"
	@echo "  make status                Muestra el estado de PM2"
	@echo "  make logs                  Sigue los logs de este proceso en PM2"

install:
	$(PNPM) install --frozen-lockfile

bootstrap: install infra-up db-deploy db-seed

infra-up:
	$(PNPM) infra:start

infra-down:
	$(PNPM) infra:stop

infra-status:
	$(PNPM) infra:status

db-deploy:
	$(PNPM) db:deploy

db-status:
	$(PNPM) db:status

db-generate:
	$(PNPM) db:generate

db-seed:
	$(PNPM) db:seed

db-migrate:
	@test -n "$(name)" || (echo "Uso: make db-migrate name=nombre_del_cambio" && exit 1)
	$(PNPM) db:migrate -- --name "$(name)"
	$(PNPM) db:generate

check:
	$(PNPM) db:validate
	$(PNPM) format:check
	$(PNPM) lint:check
	$(PNPM) test:all
	$(PNPM) build

dev:
	$(PNPM) dev

PM2_STACK ?= $(abspath ../patitas/ecosystem.patitas.config.cjs)
PM2_PROCESS ?= patitas-api

start:
	pm2 start $(PM2_STACK) --only $(PM2_PROCESS)
	pm2 save

stop:
	pm2 stop $(PM2_PROCESS)

restart:
	pm2 restart $(PM2_PROCESS)

status:
	pm2 status

logs:
	pm2 logs $(PM2_PROCESS)
