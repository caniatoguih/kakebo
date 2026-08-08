CREATE TABLE "faturas_cartao" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "cartao_id" TEXT NOT NULL,
  "competencia" TEXT NOT NULL,
  "data_inicio" TIMESTAMP(3) NOT NULL,
  "data_fim" TIMESTAMP(3) NOT NULL,
  "data_fechamento" TIMESTAMP(3) NOT NULL,
  "data_vencimento" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Aberta',
  "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total_pago" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faturas_cartao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transferencias_grupo" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "descricao" TEXT,
  "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transferencias_grupo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "transacoes" ADD COLUMN "fatura_id" TEXT;
ALTER TABLE "transacoes" ADD COLUMN "transferencia_grupo_id" TEXT;
ALTER TABLE "transacoes" ADD COLUMN "transferencia_direcao" TEXT;

CREATE TABLE "pagamentos_fatura" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "fatura_id" TEXT NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "data_pagamento" TIMESTAMP(3) NOT NULL,
  "transacao_saida_id" TEXT,
  "transacao_entrada_id" TEXT,
  "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pagamentos_fatura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faturas_cartao_cartao_id_competencia_key" ON "faturas_cartao"("cartao_id", "competencia");
CREATE INDEX "faturas_cartao_usuario_id_status_idx" ON "faturas_cartao"("usuario_id", "status");
CREATE INDEX "transacoes_fatura_id_idx" ON "transacoes"("fatura_id");
CREATE INDEX "transacoes_transferencia_grupo_id_idx" ON "transacoes"("transferencia_grupo_id");
CREATE INDEX "transferencias_grupo_usuario_id_idx" ON "transferencias_grupo"("usuario_id");
CREATE UNIQUE INDEX "pagamentos_fatura_transacao_saida_id_key" ON "pagamentos_fatura"("transacao_saida_id");
CREATE UNIQUE INDEX "pagamentos_fatura_transacao_entrada_id_key" ON "pagamentos_fatura"("transacao_entrada_id");
CREATE INDEX "pagamentos_fatura_fatura_id_data_pagamento_idx" ON "pagamentos_fatura"("fatura_id", "data_pagamento");

ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transferencias_grupo" ADD CONSTRAINT "transferencias_grupo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_fatura_id_fkey" FOREIGN KEY ("fatura_id") REFERENCES "faturas_cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_transferencia_grupo_id_fkey" FOREIGN KEY ("transferencia_grupo_id") REFERENCES "transferencias_grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_fatura_id_fkey" FOREIGN KEY ("fatura_id") REFERENCES "faturas_cartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_transacao_saida_id_fkey" FOREIGN KEY ("transacao_saida_id") REFERENCES "transacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_transacao_entrada_id_fkey" FOREIGN KEY ("transacao_entrada_id") REFERENCES "transacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
