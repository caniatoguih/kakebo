CREATE TABLE "planejamentos_salariais" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "empresa" TEXT NOT NULL,
  "ano" INTEGER NOT NULL,
  "salario_base" DECIMAL(12,2) NOT NULL,
  "conta_id" TEXT NOT NULL,
  "subcategoria_id" TEXT NOT NULL,
  "pagamento_folha" TEXT NOT NULL DEFAULT 'seguinte',
  "estimar_dezembro_anterior" BOOLEAN NOT NULL DEFAULT true,
  "incluir_decimo_terceiro" BOOLEAN NOT NULL DEFAULT true,
  "avos_decimo_terceiro" INTEGER NOT NULL DEFAULT 12,
  "modo_decimo_terceiro" TEXT NOT NULL DEFAULT 'duas',
  "mes_primeira_parcela_13" INTEGER NOT NULL DEFAULT 11,
  "mes_segunda_parcela_13" INTEGER NOT NULL DEFAULT 12,
  "descontos_mensais" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "dependentes" INTEGER NOT NULL DEFAULT 0,
  "melhor_deducao_irrf" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planejamentos_salariais_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "planejamentos_salariais_ferias" (
  "id" TEXT NOT NULL, "planejamento_id" TEXT NOT NULL, "inicio" TIMESTAMP(3) NOT NULL, "fim" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planejamentos_salariais_ferias_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "planejamentos_salariais_bonus" (
  "id" TEXT NOT NULL, "planejamento_id" TEXT NOT NULL, "mes" INTEGER NOT NULL, "valor" DECIMAL(12,2) NOT NULL,
  "incide_inss" BOOLEAN NOT NULL DEFAULT false, "incide_irrf" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planejamentos_salariais_bonus_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "planejamentos_salariais_lancamentos" (
  "id" TEXT NOT NULL, "planejamento_id" TEXT NOT NULL, "transacao_id" TEXT NOT NULL, "competencia" TEXT NOT NULL,
  "tipo_evento" TEXT NOT NULL, "valor" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planejamentos_salariais_lancamentos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "planejamentos_salariais_lancamentos_transacao_id_key" ON "planejamentos_salariais_lancamentos"("transacao_id");
CREATE UNIQUE INDEX "psl_lancamento_competencia_evento_key" ON "planejamentos_salariais_lancamentos"("planejamento_id", "competencia", "tipo_evento");
CREATE UNIQUE INDEX "planejamentos_salariais_bonus_planejamento_id_mes_key" ON "planejamentos_salariais_bonus"("planejamento_id", "mes");
CREATE INDEX "planejamentos_salariais_usuario_id_ano_idx" ON "planejamentos_salariais"("usuario_id", "ano");
CREATE INDEX "planejamentos_salariais_ferias_planejamento_id_inicio_idx" ON "planejamentos_salariais_ferias"("planejamento_id", "inicio");
CREATE INDEX "psl_lancamento_competencia_idx" ON "planejamentos_salariais_lancamentos"("planejamento_id", "competencia");
ALTER TABLE "planejamentos_salariais" ADD CONSTRAINT "planejamentos_salariais_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais" ADD CONSTRAINT "planejamentos_salariais_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais" ADD CONSTRAINT "planejamentos_salariais_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais_ferias" ADD CONSTRAINT "planejamentos_salariais_ferias_planejamento_id_fkey" FOREIGN KEY ("planejamento_id") REFERENCES "planejamentos_salariais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais_bonus" ADD CONSTRAINT "planejamentos_salariais_bonus_planejamento_id_fkey" FOREIGN KEY ("planejamento_id") REFERENCES "planejamentos_salariais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais_lancamentos" ADD CONSTRAINT "planejamentos_salariais_lancamentos_planejamento_id_fkey" FOREIGN KEY ("planejamento_id") REFERENCES "planejamentos_salariais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planejamentos_salariais_lancamentos" ADD CONSTRAINT "planejamentos_salariais_lancamentos_transacao_id_fkey" FOREIGN KEY ("transacao_id") REFERENCES "transacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
