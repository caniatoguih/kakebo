ALTER TABLE "planejamentos_salariais"
  ADD COLUMN "vale_alimentacao" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "odontologico" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "assistencia_medica" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "outros_descontos" DECIMAL(12,2) NOT NULL DEFAULT 0;
