CREATE TABLE "auditorias_financeiras" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "request_id" TEXT,
  "acao" TEXT NOT NULL,
  "entidade" TEXT NOT NULL,
  "entidade_id" TEXT,
  "dados" JSONB,
  "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditorias_financeiras_usuario_id_data_criacao_idx"
  ON "auditorias_financeiras"("usuario_id", "data_criacao");
CREATE INDEX "auditorias_financeiras_entidade_entidade_id_idx"
  ON "auditorias_financeiras"("entidade", "entidade_id");
CREATE INDEX "auditorias_financeiras_request_id_idx"
  ON "auditorias_financeiras"("request_id");

ALTER TABLE "auditorias_financeiras" ADD CONSTRAINT "auditorias_financeiras_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
