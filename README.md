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
3.  Configure as variáveis de ambiente criando um arquivo `.env` na raiz da pasta `kakebo`:
    ```env
    DATABASE_URL="file:./dev.db"
    JWT_SECRET="sua-chave-secreta-kakebo"
    PORT=3333
    ```
4.  Rode as migrações do Prisma para criar as tabelas do banco de dados:
    ```bash
    npx prisma migrate dev
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

## 📂 Organização do Repositório (Git Flow)

Este repositório está estruturado na branch principal de desenvolvimento:
*   **Branch Principal:** `dev` (sincronizada no GitHub)
*   **Política de Git:** Todos os arquivos de ambiente local (`.env`), builds (`dist/`, `.next/`), banco de dados SQLite (`prisma/dev.db`) e pastas `node_modules` estão devidamente protegidos através do arquivo `.gitignore`.

---

## 🇯🇵 Filosofia Kakebo
> *"A gestão de dinheiro não se trata apenas de cortar custos, mas sim de conscientização e equilíbrio de escolhas."*
