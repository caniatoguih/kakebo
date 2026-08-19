CREATE TABLE "user_vehicles" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "ano" INTEGER,
    "fuel_type" TEXT NOT NULL,
    "city_efficiency_km_per_l" DECIMAL(10,3) NOT NULL,
    "highway_efficiency_km_per_l" DECIMAL(10,3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_vehicles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fuel_scenarios"
    ADD COLUMN "user_vehicle_id" TEXT,
    ADD COLUMN "fuel_type" TEXT,
    ADD COLUMN "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE "fuel_scenario_budget_allocations" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fuel_scenario_id" TEXT NOT NULL,
    "subcategoria_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valor_orcado" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fuel_scenario_budget_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fuel_scenario_cashflow_forecasts" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fuel_scenario_id" TEXT NOT NULL,
    "transacao_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fuel_scenario_cashflow_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_vehicles_usuario_id_ativo_idx" ON "user_vehicles"("usuario_id", "ativo");
CREATE UNIQUE INDEX "fuel_scenario_budget_allocations_fuel_scenario_id_mes_ano_key" ON "fuel_scenario_budget_allocations"("fuel_scenario_id", "mes", "ano");
CREATE INDEX "fuel_scenario_budget_allocations_usuario_id_ano_mes_idx" ON "fuel_scenario_budget_allocations"("usuario_id", "ano", "mes");
CREATE UNIQUE INDEX "fuel_scenario_cashflow_forecasts_transacao_id_key" ON "fuel_scenario_cashflow_forecasts"("transacao_id");
CREATE UNIQUE INDEX "fuel_scenario_cashflow_forecasts_fuel_scenario_id_mes_ano_key" ON "fuel_scenario_cashflow_forecasts"("fuel_scenario_id", "mes", "ano");
CREATE INDEX "fuel_scenario_cashflow_forecasts_usuario_id_ano_mes_idx" ON "fuel_scenario_cashflow_forecasts"("usuario_id", "ano", "mes");

ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenarios" ADD CONSTRAINT "fuel_scenarios_user_vehicle_id_fkey" FOREIGN KEY ("user_vehicle_id") REFERENCES "user_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_budget_allocations" ADD CONSTRAINT "fuel_scenario_budget_allocations_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_budget_allocations" ADD CONSTRAINT "fuel_scenario_budget_allocations_fuel_scenario_id_fkey" FOREIGN KEY ("fuel_scenario_id") REFERENCES "fuel_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_budget_allocations" ADD CONSTRAINT "fuel_scenario_budget_allocations_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_cashflow_forecasts" ADD CONSTRAINT "fuel_scenario_cashflow_forecasts_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_cashflow_forecasts" ADD CONSTRAINT "fuel_scenario_cashflow_forecasts_fuel_scenario_id_fkey" FOREIGN KEY ("fuel_scenario_id") REFERENCES "fuel_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_scenario_cashflow_forecasts" ADD CONSTRAINT "fuel_scenario_cashflow_forecasts_transacao_id_fkey" FOREIGN KEY ("transacao_id") REFERENCES "transacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
