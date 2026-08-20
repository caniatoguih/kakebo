CREATE TABLE "tokens_redefinicao_senha" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "usado_em" TIMESTAMP(3),
  "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tokens_redefinicao_senha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_redefinicao_senha_token_hash_key"
  ON "tokens_redefinicao_senha"("token_hash");

CREATE INDEX "tokens_redefinicao_senha_usuario_id_expira_em_idx"
  ON "tokens_redefinicao_senha"("usuario_id", "expira_em");

ALTER TABLE "tokens_redefinicao_senha"
  ADD CONSTRAINT "tokens_redefinicao_senha_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
