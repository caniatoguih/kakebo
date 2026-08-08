BEGIN;

-- Phase 4: preserve existing values while converting free-form text columns to enums.
CREATE TYPE "TipoConta" AS ENUM ('Corrente', 'Poupanca', 'Dinheiro', 'CartaoCredito');
CREATE TYPE "PilarCategoria" AS ENUM ('Sobrevivencia', 'Lazer', 'Cultura', 'Extras');
CREATE TYPE "TipoLancamento" AS ENUM ('Receita', 'Despesa', 'Transferencia');
CREATE TYPE "StatusTransacao" AS ENUM ('Pendente', 'Pago');
CREATE TYPE "StatusFatura" AS ENUM ('Aberta', 'Fechada', 'ParcialmentePaga', 'Paga', 'Vencida');
CREATE TYPE "DirecaoTransferencia" AS ENUM ('Entrada', 'Saida');

ALTER TABLE "contas_bancarias"
  ALTER COLUMN "tipo" TYPE "TipoConta" USING "tipo"::text::"TipoConta";
ALTER TABLE "categorias"
  ALTER COLUMN "pilar" TYPE "PilarCategoria" USING "pilar"::text::"PilarCategoria",
  ALTER COLUMN "tipo" TYPE "TipoLancamento" USING "tipo"::text::"TipoLancamento";
ALTER TABLE "transacoes"
  ALTER COLUMN "tipo" TYPE "TipoLancamento" USING "tipo"::text::"TipoLancamento",
  ALTER COLUMN "status" TYPE "StatusTransacao" USING "status"::text::"StatusTransacao",
  ALTER COLUMN "transferencia_direcao" TYPE "DirecaoTransferencia"
    USING "transferencia_direcao"::text::"DirecaoTransferencia";
ALTER TABLE "faturas_cartao" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "faturas_cartao"
  ALTER COLUMN "status" TYPE "StatusFatura" USING "status"::text::"StatusFatura";
ALTER TABLE "faturas_cartao" ALTER COLUMN "status" SET DEFAULT 'Aberta';

CREATE UNIQUE INDEX "orcamentos_usuario_id_subcategoria_id_mes_ano_key"
  ON "orcamentos"("usuario_id", "subcategoria_id", "mes", "ano");
CREATE INDEX "orcamentos_usuario_id_ano_mes_idx" ON "orcamentos"("usuario_id", "ano", "mes");
CREATE INDEX "contas_bancarias_usuario_id_tipo_idx" ON "contas_bancarias"("usuario_id", "tipo");
CREATE INDEX "contas_bancarias_usuario_id_nome_idx" ON "contas_bancarias"("usuario_id", "nome");
CREATE INDEX "categorias_usuario_id_tipo_idx" ON "categorias"("usuario_id", "tipo");
CREATE INDEX "subcategorias_categoria_id_idx" ON "subcategorias"("categoria_id");
CREATE INDEX "transacoes_usuario_id_data_transacao_idx" ON "transacoes"("usuario_id", "data_transacao");
CREATE INDEX "transacoes_usuario_id_conta_id_data_transacao_idx"
  ON "transacoes"("usuario_id", "conta_id", "data_transacao");
CREATE INDEX "transacoes_usuario_id_status_data_transacao_idx"
  ON "transacoes"("usuario_id", "status", "data_transacao");
CREATE INDEX "transacoes_transacao_pai_id_idx" ON "transacoes"("transacao_pai_id");

ALTER TABLE "contas_bancarias" DROP CONSTRAINT "contas_bancarias_usuario_id_fkey";
ALTER TABLE "cartoes_credito_detalhes" DROP CONSTRAINT "cartoes_credito_detalhes_conta_id_fkey";
ALTER TABLE "categorias" DROP CONSTRAINT "categorias_usuario_id_fkey";
ALTER TABLE "subcategorias" DROP CONSTRAINT "subcategorias_categoria_id_fkey";
ALTER TABLE "orcamentos" DROP CONSTRAINT "orcamentos_usuario_id_fkey";
ALTER TABLE "orcamentos" DROP CONSTRAINT "orcamentos_subcategoria_id_fkey";
ALTER TABLE "transacoes" DROP CONSTRAINT "transacoes_usuario_id_fkey";
ALTER TABLE "transacoes" DROP CONSTRAINT "transacoes_conta_id_fkey";
ALTER TABLE "faturas_cartao" DROP CONSTRAINT "faturas_cartao_usuario_id_fkey";
ALTER TABLE "faturas_cartao" DROP CONSTRAINT "faturas_cartao_cartao_id_fkey";
ALTER TABLE "pagamentos_fatura" DROP CONSTRAINT "pagamentos_fatura_usuario_id_fkey";
ALTER TABLE "pagamentos_fatura" DROP CONSTRAINT "pagamentos_fatura_fatura_id_fkey";
ALTER TABLE "transferencias_grupo" DROP CONSTRAINT "transferencias_grupo_usuario_id_fkey";

ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cartoes_credito_detalhes" ADD CONSTRAINT "cartoes_credito_detalhes_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cartoes_credito_detalhes" ADD CONSTRAINT "cartoes_credito_detalhes_conta_pagamento_padrao_id_fkey"
  FOREIGN KEY ("conta_pagamento_padrao_id") REFERENCES "contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcategorias" ADD CONSTRAINT "subcategorias_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_subcategoria_id_fkey"
  FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_cartao_id_fkey"
  FOREIGN KEY ("cartao_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_fatura_id_fkey"
  FOREIGN KEY ("fatura_id") REFERENCES "faturas_cartao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transferencias_grupo" ADD CONSTRAINT "transferencias_grupo_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
