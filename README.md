# 🇯🇵 Kakebo — Sistema Inteligente de Finanças Pessoais

> Um gestor de finanças moderno e premium inspirado na filosofia milenar japonesa de orçamento pessoal (**Kakebo**), combinado com uma interface de alta performance inspirada em dashboards financeiros de elite.

---

## ✨ Recursos de Destaque (Premium Experience)

### 📊 Painel Kakebo & Dashboard
*   **Os 4 Pilares do Kakebo:** Divisão automática dos seus gastos em:
    *   **Sobrevivência (Necessidades):** Alimentação, moradia, saúde.
    *   **Cultura & Lazer:** Livros, cinema, museus.
    *   **Opcionais (Desejos):** Compras, restaurantes, hobbies.
    *   **Extras (Imprevistos):** Reparos, emergências, gastos sazonais.
*   **Gráficos Avançados:** Acompanhamento dinâmico do Orçado vs. Realizado.
*   **Relatório de Reflexão:** Pergunta-chave mensal para ajudar você a economizar e atingir seus objetivos de poupança de forma consciente.

### 💳 Gestão Avançada de Contas & Faturas de Cartão
*   **Faturas 100% Contábeis:** Compras com cartão aumentam seu saldo devedor de forma transparente sem duplicar despesas no dashboard.
*   **Pagar Fatura em 1 Clique:** Modal inteligente que liquida a fatura gerando uma **Transferência** entre a sua conta corrente e o cartão. O limite do cartão é restabelecido instantaneamente e o dinheiro sai da conta de origem.

### 💸 Filtros Inteligentes de Fluxo de Caixa
*   **Visual Compacto & Colapsável:** Painel de filtros retrátil por padrão para maximizar a área útil de trabalho.
*   **Flexibilidade Total:** Filtre transações por Status (Pago, Pendente), por Mês Selecionado, por Período de Datas Personalizado ou por Conta específica.

### 🧠 Sincronização Inteligente de Extratos (OFX & CSV)
*   **Reconciliação Automática:** O sistema cruza os lançamentos do extrato com transações existentes de forma atômica (tolerância de ±5 dias).
*   **Autodetecção Inteligente de Cartões:** Identifica automaticamente pagamentos de faturas de cartão no extrato (por valor exato ou por palavras-chave) e sugere a transferência correta.
*   **Identificação de Pix e Transferências:** Distingue transferências internas (entre contas do usuário) de transferências e receitas externas.

---

## 🛠️ Stack Tecnológica

### Backend (Serviço & API)
*   **Core:** Node.js, Express, TypeScript.
*   **Banco de Dados & ORM:** Prisma ORM com suporte a PostgreSQL/SQLite.
*   **Validação:** Zod schemas para robustez de tipos.

### Frontend (Aplicação Web)
*   **Framework:** React (Vite), TypeScript.
*   **Estilização:** TailwindCSS, Shadcn/ui (Tailored harmony colors).
*   **Gerenciamento de Estado & Requisições:** TanStack Query (React Query) para sincronia de cache instantânea.
*   **Ícones:** Lucide React.

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
*   Node.js (v18 ou superior)
*   NPM ou Yarn

### 2. Configurando o Backend

1.  Acesse a pasta raiz do projeto:
    ```bash
    cd kakebo
    ```
2.  Instale as dependências do servidor:
    ```bash
    npm install
    ```
3.  Configure as variáveis de ambiente criando um arquivo `.env` na raiz (veja `.env.example`):
    ```env
    DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/kakebo"
    JWT_SECRET="sua-chave-secreta-kakebo"
    PORT=3000
    ```
4.  Crie o schema no banco (migrações ou push):
    ```bash
    npx prisma db push
    # ou, se houver pasta prisma/migrations:
    # npx prisma migrate dev
    ```
5.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

### 3. Configurando o Frontend

1.  Abra um novo terminal e acesse a pasta do frontend:
    ```bash
    cd kakebo/frontend
    ```
2.  Instale as dependências da interface:
    ```bash
    npm install
    ```
3.  Inicie o servidor do frontend:
    ```bash
    npm run dev
    ```
4.  Acesse `http://localhost:5173` no seu navegador!

---

## ☁️ Deploy no Netlify (frontend + backend)

O projeto está preparado para **um único site no Netlify**:
- **Frontend** (Vite/React) → estático em `frontend/dist`
- **Backend** (Express + Prisma) → Netlify Function em `netlify/functions/api.ts`
- Rotas `/api/*` são reescritas para a function; o SPA usa fallback para `index.html`

### 1. Banco de dados PostgreSQL

O Netlify **não** hospeda Postgres. Use um provedor gratuito/pago e copie a connection string:

| Provedor | Dica |
|----------|------|
| [Neon](https://neon.tech) | Use a URL **pooled** (serverless) |
| [Supabase](https://supabase.com) | Connection pooling (porta 6543) se disponível |
| [Railway](https://railway.app) / [Aiven](https://aiven.io) | Postgres gerenciado |

O schema de produção é sincronizado pelo GitHub Actions após os testes de backend,
frontend e E2E passarem em um push para a branch `main`. Cadastre em
**Settings → Secrets and variables → Actions** o secret:

- `DB_URL`: connection string direta do Neon, com SSL, usada exclusivamente para
  executar `prisma migrate deploy`.

O workflow converte `DB_URL` em `DATABASE_URL` somente durante a migration,
serializa execuções concorrentes e interrompe o deploy de banco quando o secret
estiver ausente ou uma migration falhar. Na primeira execução contra um banco
existente sem histórico do Prisma, ele compara o Neon ao snapshot
`prisma/baseline.prisma` e só registra a migration `0_init` quando não houver
diferença. Depois aplica, em ordem, as migrations incrementais pendentes. Netlify
e Vercel continuam usando a
variável `DATABASE_URL` configurada em cada plataforma para a aplicação em runtime;
para esse uso serverless, prefira a URL pooled do Neon.

> Se a comparação encontrar qualquer divergência, o workflow cancela o baseline
> sem alterar o histórico. Revise o relatório antes de modificar o banco de produção.

### 2. Variáveis de ambiente no Netlify

No painel: **Site configuration → Environment variables**:

| Variável | Obrigatória | Valor |
|----------|-------------|--------|
| `DATABASE_URL` | Sim | Connection string Postgres (preferir pooling) |
| `JWT_SECRET` | Sim | Segredo longo e aleatório |
| `NODE_ENV` | Recomendado | `production` |
| `CORS_ORIGIN` | Opcional | URL do site, ex. `https://seu-app.netlify.app` |
| `VITE_API_URL` | Não (mesmo site) | Deixe vazio — o frontend usa `/api` em produção |

> `VITE_*` precisa existir **no build**. Se um dia a API for outro domínio, defina `VITE_API_URL` antes do deploy.

### 3. Conectar o repositório

1. Faça push deste repositório para o GitHub/GitLab/Bitbucket.
2. Em [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project**.
3. Selecione o repositório.
4. Confirme (o `netlify.toml` na raiz já define):
   - **Build command:** `npm run netlify-build`
   - **Publish directory:** `frontend/dist`
   - **Functions directory:** `netlify/functions`
5. Cadastre as variáveis de ambiente e clique em **Deploy**.

### 4. Validar o deploy

- Site: `https://SEU-SITE.netlify.app`
- Health da API: `https://SEU-SITE.netlify.app/api/health` → `{ "status": "ok" }`
- Login/cadastro pela interface

### 5. Desenvolvimento local com Netlify CLI (opcional)

```bash
npm install -g netlify-cli
# Com DATABASE_URL e JWT_SECRET no .env da raiz:
netlify dev
```

Isso sobe frontend + functions com os redirects do `netlify.toml`.

### Arquitetura do deploy

```
Browser
  ├─ /*           → frontend/dist (SPA)
  └─ /api/*       → Netlify Function (Express + Prisma)
                         └─ PostgreSQL (Neon/Supabase/...)
```

---

## 📂 Organização do Repositório (Git Flow)

Este repositório está estruturado na branch principal de desenvolvimento:
*   **Branch Principal:** `dev` (sincronizada no GitHub)
*   **Política de Git:** Arquivos de ambiente (`.env`), builds (`dist/`), bancos locais e `node_modules` estão no `.gitignore`. Use `.env.example` como referência.

## ✅ Qualidade e testes

A linha de base, os fluxos financeiros cobertos e os comandos de validação estão documentados em [`docs/LINHA_BASE_TESTES.md`](docs/LINHA_BASE_TESTES.md).

Os procedimentos de logs, métricas, auditoria, backup e restauração estão em [`docs/OPERACAO.md`](docs/OPERACAO.md).

---

## 🇯🇵 Filosofia Kakebo
> *"A gestão de dinheiro não se trata apenas de cortar custos, mas sim de conscientização e equilíbrio de escolhas."*
