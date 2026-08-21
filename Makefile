PNPM ?= pnpm
name ?=

.PHONY: help install bootstrap infra-up infra-down infra-status db-deploy db-status db-generate db-seed db-migrate check dev

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
	@echo "  make dev                   Inicia NestJS en modo watch"

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
