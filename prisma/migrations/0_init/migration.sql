-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('Corrente', 'Poupanca', 'Dinheiro', 'CartaoCredito');

-- CreateEnum
CREATE TYPE "PilarCategoria" AS ENUM ('Sobrevivencia', 'Lazer', 'Cultura', 'Extras');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('Receita', 'Despesa', 'Transferencia');

-- CreateEnum
CREATE TYPE "StatusTransacao" AS ENUM ('Pendente', 'Pago');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('Aberta', 'Fechada', 'ParcialmentePaga', 'Paga', 'Vencida');

-- CreateEnum
CREATE TYPE "DirecaoTransferencia" AS ENUM ('Entrada', 'Saida');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL,
    "saldo_inicial" DECIMAL(10,2) NOT NULL,
    "saldo_atual" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cartoes_credito_detalhes" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "limite_total" DECIMAL(10,2) NOT NULL,
    "dia_fechamento" INTEGER NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "conta_pagamento_padrao_id" TEXT,

    CONSTRAINT "cartoes_credito_detalhes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pilar" "PilarCategoria" NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategorias" (
    "id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "subcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "subcategoria_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valor_orcado" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "subcategoria_id" TEXT,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "data_transacao" TIMESTAMP(3) NOT NULL,
    "status" "StatusTransacao" NOT NULL,
    "parcela_atual" INTEGER NOT NULL DEFAULT 1,
    "total_parcelas" INTEGER NOT NULL DEFAULT 1,
    "transacao_pai_id" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "fatura_id" TEXT,
    "transferencia_grupo_id" TEXT,
    "transferencia_direcao" "DirecaoTransferencia",

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas_cartao" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cartao_id" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "data_fechamento" TIMESTAMP(3) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'Aberta',
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_pago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturas_cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "transferencias_grupo" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "descricao" TEXT,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "contas_bancarias_usuario_id_tipo_idx" ON "contas_bancarias"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "contas_bancarias_usuario_id_nome_idx" ON "contas_bancarias"("usuario_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "cartoes_credito_detalhes_conta_id_key" ON "cartoes_credito_detalhes"("conta_id");

-- CreateIndex
CREATE INDEX "categorias_usuario_id_tipo_idx" ON "categorias"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "subcategorias_categoria_id_idx" ON "subcategorias"("categoria_id");

-- CreateIndex
CREATE INDEX "orcamentos_usuario_id_ano_mes_idx" ON "orcamentos"("usuario_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_usuario_id_subcategoria_id_mes_ano_key" ON "orcamentos"("usuario_id", "subcategoria_id", "mes", "ano");

-- CreateIndex
CREATE INDEX "transacoes_fatura_id_idx" ON "transacoes"("fatura_id");

-- CreateIndex
CREATE INDEX "transacoes_transferencia_grupo_id_idx" ON "transacoes"("transferencia_grupo_id");

-- CreateIndex
CREATE INDEX "transacoes_usuario_id_data_transacao_idx" ON "transacoes"("usuario_id", "data_transacao");

-- CreateIndex
CREATE INDEX "transacoes_usuario_id_conta_id_data_transacao_idx" ON "transacoes"("usuario_id", "conta_id", "data_transacao");

-- CreateIndex
CREATE INDEX "transacoes_usuario_id_status_data_transacao_idx" ON "transacoes"("usuario_id", "status", "data_transacao");

-- CreateIndex
CREATE INDEX "transacoes_transacao_pai_id_idx" ON "transacoes"("transacao_pai_id");

-- CreateIndex
CREATE INDEX "faturas_cartao_usuario_id_status_idx" ON "faturas_cartao"("usuario_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_cartao_cartao_id_competencia_key" ON "faturas_cartao"("cartao_id", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_fatura_transacao_saida_id_key" ON "pagamentos_fatura"("transacao_saida_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_fatura_transacao_entrada_id_key" ON "pagamentos_fatura"("transacao_entrada_id");

-- CreateIndex
CREATE INDEX "pagamentos_fatura_fatura_id_data_pagamento_idx" ON "pagamentos_fatura"("fatura_id", "data_pagamento");

-- CreateIndex
CREATE INDEX "transferencias_grupo_usuario_id_idx" ON "transferencias_grupo"("usuario_id");

-- CreateIndex
CREATE INDEX "auditorias_financeiras_usuario_id_data_criacao_idx" ON "auditorias_financeiras"("usuario_id", "data_criacao");

-- CreateIndex
CREATE INDEX "auditorias_financeiras_entidade_entidade_id_idx" ON "auditorias_financeiras"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "auditorias_financeiras_request_id_idx" ON "auditorias_financeiras"("request_id");

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartoes_credito_detalhes" ADD CONSTRAINT "cartoes_credito_detalhes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartoes_credito_detalhes" ADD CONSTRAINT "cartoes_credito_detalhes_conta_pagamento_padrao_id_fkey" FOREIGN KEY ("conta_pagamento_padrao_id") REFERENCES "contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategorias" ADD CONSTRAINT "subcategorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_fatura_id_fkey" FOREIGN KEY ("fatura_id") REFERENCES "faturas_cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_transferencia_grupo_id_fkey" FOREIGN KEY ("transferencia_grupo_id") REFERENCES "transferencias_grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_fatura_id_fkey" FOREIGN KEY ("fatura_id") REFERENCES "faturas_cartao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_transacao_saida_id_fkey" FOREIGN KEY ("transacao_saida_id") REFERENCES "transacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_transacao_entrada_id_fkey" FOREIGN KEY ("transacao_entrada_id") REFERENCES "transacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_grupo" ADD CONSTRAINT "transferencias_grupo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_financeiras" ADD CONSTRAINT "auditorias_financeiras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
