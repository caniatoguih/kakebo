# Plano de Implementação — Identidade Visual Kakebo

## Objetivo

Aplicar ao Kakebo a identidade visual **“Caderno Consciente”**, modernizando a interface atual sem alterar a lógica de negócio já existente.

A implementação deve usar **shadcn/ui** como base de componentes, mantendo o produto funcional durante toda a migração.

A nova interface deve transmitir:

- organização;
- clareza;
- reflexão;
- acolhimento;
- confiança;
- consciência financeira.

O produto não deve ter aparência de banco ou fintech tradicional. A referência visual é um **caderno financeiro contemporâneo**, com estética editorial leve e elementos discretos relacionados a planejamento e reflexão.

---

# 1. Stack visual

## Bibliotecas

Utilizar preferencialmente:

- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- `class-variance-authority`
- `tailwind-merge`
- `clsx`

Caso o projeto já possua equivalentes, preservar a stack existente sempre que possível.

---

# 2. Assets da identidade

Adicionar os assets da nova identidade em uma pasta dedicada.

```text
/public
  /brand
    kakebo-logo-primary.png
    kakebo-logo-inverse.png
    kakebo-app-icon.png
    kakebo-symbol.png
```

Sugestão de utilização:

| Asset | Uso |
|---|---|
| Logo principal | Sidebar, login, telas institucionais |
| Logo inversa | Fundos verdes ou escuros |
| App icon | PWA, ícone do aplicativo |
| Símbolo | Favicon, loading, empty states e detalhes gráficos |

Criar também versões SVG posteriormente para melhorar escalabilidade.

---

# 3. Design Tokens

Centralizar os tokens visuais no tema do Tailwind/shadcn.

## Paleta principal

```css
--kakebo-forest: #2F5A46;
--kakebo-sage: #A7B89A;
--kakebo-blue: #6D8CA6;
--kakebo-terracotta: #C76F5A;
--kakebo-clay: #DDB79E;
--kakebo-cream: #F4EEE6;
--kakebo-graphite: #333333;
```

## Tokens semânticos

```css
--background: #FBF9F5;
--foreground: #333333;

--card: #FFFFFF;
--card-foreground: #333333;

--primary: #2F5A46;
--primary-foreground: #FFFFFF;

--secondary: #EEF2EA;
--secondary-foreground: #2F5A46;

--muted: #F4EEE6;
--muted-foreground: #756F68;

--accent: #A7B89A;
--accent-foreground: #2F5A46;

--destructive: #C76F5A;
--destructive-foreground: #FFFFFF;

--border: #E5DED5;
--input: #E5DED5;
--ring: #2F5A46;
```

## Tokens adicionais

```css
--success: #2F7A5C;
--warning: #C58B35;
--info: #6D8CA6;

--chart-income: #2F7A5C;
--chart-expense: #C76F5A;
--chart-extra: #6D8CA6;
--chart-leisure: #A7B89A;
--chart-culture: #DDB79E;
```

---

# 4. Tipografia

## Fonte de interface

Utilizar **Inter**.

Aplicação:

- labels;
- formulários;
- tabelas;
- menus;
- números;
- textos auxiliares;
- botões.

## Fonte de destaque

Utilizar **DM Sans**.

Aplicação:

- títulos;
- subtítulos;
- indicadores;
- chamadas;
- cards de insights.

Sugestão:

```text
H1: DM Sans 700 — 36/44
H2: DM Sans 700 — 28/36
H3: DM Sans 600 — 22/30

Body: Inter 400 — 14/22
Small: Inter 400 — 12/18
Label: Inter 500 — 13/18
```

Evitar serifas no produto final, mesmo que alguns mockups conceituais utilizem aparência editorial.

---

# 5. Radius, sombras e espaçamento

## Border radius

Padronizar:

```text
sm: 8px
md: 12px
lg: 16px
xl: 20px
```

Cards principais:

```text
16px
```

Botões:

```text
10px
```

Inputs:

```text
10px
```

## Sombras

Evitar sombras fortes.

Preferir:

```css
box-shadow:
  0 1px 2px rgba(51, 51, 51, 0.04),
  0 4px 12px rgba(51, 51, 51, 0.04);
```

A hierarquia deve vir principalmente de:

- espaço;
- borda;
- cor;
- tipografia.

---

# 6. Estrutura de componentes

Criar uma camada de componentes reutilizáveis sobre o shadcn/ui.

```text
src/
  components/
    ui/
    brand/
    layout/
    finance/
    charts/
```

---

# 7. Componentes de marca

Criar:

```text
src/components/brand/
  KakeboLogo.tsx
  KakeboSymbol.tsx
  BrandPattern.tsx
  BrandQuote.tsx
```

## `KakeboLogo`

Props sugeridas:

```ts
type KakeboLogoProps = {
  variant?: "primary" | "inverse" | "symbol";
  size?: "sm" | "md" | "lg";
};
```

---

# 8. Layout principal

Criar:

```text
src/components/layout/
  AppShell.tsx
  AppSidebar.tsx
  AppHeader.tsx
  PageHeader.tsx
  MonthNavigator.tsx
```

---

# 9. Sidebar

A sidebar atual pode ser preservada estruturalmente, mas deve ser redesenhada.

## Estado normal

```text
texto: graphite
ícone: muted-foreground
background: transparente
```

## Hover

```text
background: sage / 15%
foreground: forest
```

## Ativo

```text
background: forest
foreground: white
```

OU, para uma versão mais leve:

```text
background: #EAF0E8
foreground: forest
border-left: 3px forest
```

Recomendação para o Kakebo:

**usar a versão leve** para não deixar a navegação pesada.

## Estrutura

```text
Logo

Reflexão
Fluxo de Caixa

Planejamento
 ├ Orçamento mensal
 └ Consumo de Combustível

Visão Contábil
Recorrências
Contas e Cartões
Categorias
Lembretes

------------------

Perfil
Sair
```

---

# 10. Page Header

Padronizar todas as páginas.

Exemplo:

```tsx
<PageHeader
  title="Reflexão Kakebo"
  description="O coração do Kakebo: analise como você viveu este mês."
  actions={<MonthNavigator />}
/>
```

Evitar títulos e filtros soltos diretamente nas páginas.

---

# 11. Month Navigator

Substituir controles manuais existentes por um componente reutilizável.

```text
[ ← ] Agosto 2026 [ → ]
```

Utilizar:

```text
Button variant="outline"
```

ou:

```text
ToggleGroup
```

Garantir:

- navegação por teclado;
- `aria-label`;
- loading state durante troca do período.

---

# 12. KPI Cards

Criar um componente:

```text
src/components/finance/KpiCard.tsx
```

API sugerida:

```ts
interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
    tone: "positive" | "negative" | "neutral";
  };
  icon?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "info";
}
```

Exemplo:

```tsx
<KpiCard
  title="Receitas"
  value="R$ 10.179,15"
  tone="success"
  trend={{
    value: "73% vs. mês anterior",
    direction: "up",
    tone: "positive"
  }}
/>
```

---

# 13. Uso correto das cores financeiras

Não usar verde automaticamente para qualquer alta.

A semântica deve depender do contexto.

## Receita

Alta:

```text
positivo → verde
```

## Despesas

Alta:

```text
negativo → terracota/vermelho
```

## Resultado

Positivo:

```text
verde
```

Negativo:

```text
terracota
```

Isso deve ser calculado no componente ou na camada de apresentação.

---

# 14. Insights

Criar:

```text
src/components/finance/InsightCard.tsx
```

Tipos:

```ts
type InsightTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";
```

Exemplo:

```tsx
<InsightCard
  title="Orçamento pode ser ultrapassado"
  description="A projeção indica excesso de R$ 1.203,36 até o fechamento."
  tone="warning"
/>
```

Evitar cores saturadas.

Usar background com aproximadamente 5% a 10% da cor do estado.

---

# 15. Cards

Usar o componente `Card` do shadcn.

Padrão:

```tsx
<Card className="rounded-2xl border-border/70 shadow-sm">
```

Evitar vários tipos de sombra e border radius diferentes.

---

# 16. Botões

Utilizar as variantes do shadcn.

## Primary

```text
background: forest
foreground: white
```

## Secondary

```text
background: sage / 20%
foreground: forest
```

## Outline

```text
border: forest / 25%
foreground: forest
```

## Destructive

```text
background: terracotta
foreground: white
```

---

# 17. Badges

Criar variantes para:

```text
Pago
Pendente
Planejado
Meta atingida
Atenção
Novo
```

Exemplo:

```tsx
<Badge variant="success">Pago</Badge>
```

Adicionar variantes ao componente `badge.tsx` utilizando CVA.

---

# 18. Inputs

Padronizar:

```text
altura: 40px
radius: 10px
background: white
border: border
focus ring: forest
```

Labels sempre acima.

Exemplo:

```text
Categoria

[ Alimentação                    v ]
```

Evitar placeholder substituindo label.

---

# 19. Cards de formulário

Para formulários longos:

```text
Card
  CardHeader
  CardContent
```

Separar seções conceituais.

Exemplo:

```text
Informações gerais

Valor
Categoria
Data

----------------

Recorrência

Tipo
Frequência
Data final
```

---

# 20. Gráficos

Manter Recharts.

Criar wrapper:

```text
src/components/charts/KakeboChart.tsx
```

Tokens:

```ts
const chartColors = {
  income: "#2F5A46",
  expense: "#C76F5A",
  extra: "#6D8CA6",
  leisure: "#A7B89A",
  culture: "#DDB79E",
};
```

## Grid

```text
#EEE8DF
```

## Labels

```text
#756F68
```

## Tooltip

Utilizar `Card` visualmente.

---

# 21. Evolução financeira

Na tela de Reflexão:

Manter gráfico de barras.

Melhorias:

- mais espaço entre grupos;
- grid horizontal discreto;
- legendas compactas;
- tooltip customizado;
- usar animação curta;
- destacar o mês atual.

Sugestão:

```text
Receitas: forest
Despesas: terracotta
```

---

# 22. Maiores desvios

Transformar a área em componente:

```text
BudgetDeviationList.tsx
```

Cada item:

```text
Sobrevivência

R$ 18.955 realizado de R$ 17.898 planejado

████████████████████░

+ R$ 1.056,86
```

Regra:

```text
acima do orçamento → terracotta
abaixo → forest
```

---

# 23. Elementos “Caderno Consciente”

Adicionar discretamente elementos editoriais.

Não aplicar textura em todos os cards.

Utilizar principalmente em:

- tela de Reflexão;
- empty states;
- onboarding;
- fechamento mensal;
- cabeçalhos especiais.

Exemplos:

```text
linha manuscrita
folhas minimalistas
notas curtas
fundo papel discreto
```

Evitar aparência scrapbook.

---

# 24. Reflexão mensal

Esta deve ser a tela com maior presença da identidade.

Adicionar uma área complementar:

```text
Reflexão do mês

Como foi seu mês?

O que você aprendeu?

Do que você se orgulha?

O que pode melhorar?
```

Componente:

```text
MonthlyReflection.tsx
```

Utilizar:

```text
Textarea
Card
Separator
Button
```

---

# 25. Empty States

Criar:

```text
EmptyState.tsx
```

Exemplo:

```text
Você ainda não possui dados para este período.

Registre suas movimentações para começar a construir sua reflexão financeira.

[ Adicionar movimentação ]
```

Adicionar símbolo do Kakebo com baixa opacidade.

---

# 26. Loading States

Utilizar `Skeleton` do shadcn.

Exemplo:

```tsx
<KpiCardSkeleton />
<ChartSkeleton />
<InsightSkeleton />
```

Não usar spinner central para páginas inteiras.

---

# 27. Toasts

Usar `Sonner`.

Exemplos:

```text
Movimentação registrada.
Planejamento atualizado.
Reflexão salva.
```

Erros:

```text
Não foi possível salvar a movimentação.
Tente novamente.
```

---

# 28. Dialogs

Padronizar com shadcn:

```text
Dialog
AlertDialog
Sheet
Drawer
```

Desktop:

```text
Dialog / Sheet
```

Mobile:

```text
Drawer
```

---

# 29. Responsividade

## Desktop

Sidebar:

```text
240–260px
```

Conteúdo:

```text
max-width: 1440px
```

## Tablet

Sidebar recolhida.

## Mobile

Substituir sidebar por:

```text
Sheet
```

KPIs:

```text
1 coluna
```

Insights:

```text
1 coluna
```

Gráficos:

```text
horizontal scroll somente quando inevitável
```

---

# 30. Grid recomendado

Para desktop:

```css
grid-template-columns: repeat(12, minmax(0, 1fr));
gap: 24px;
```

KPIs:

```text
3 colunas cada
```

Gráficos:

```text
8 colunas
```

Maiores desvios:

```text
4 colunas
```

Em telas menores:

```text
6 + 6
```

e depois:

```text
12
```

---

# 31. Acessibilidade

Obrigatório:

- contraste WCAG AA;
- foco visível;
- navegação via teclado;
- `aria-label` em botões apenas com ícone;
- tooltips em ícones;
- `aria-expanded` em menus;
- não depender exclusivamente de cores.

Exemplo:

Não usar apenas vermelho para indicar valor negativo.

Adicionar também:

```text
ícone
texto
prefixo +
prefixo -
```

---

# 32. Estrutura sugerida

```text
src/
├── components/
│   ├── brand/
│   │   ├── KakeboLogo.tsx
│   │   ├── KakeboSymbol.tsx
│   │   └── BrandPattern.tsx
│   │
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── AppHeader.tsx
│   │   ├── PageHeader.tsx
│   │   └── MonthNavigator.tsx
│   │
│   ├── finance/
│   │   ├── KpiCard.tsx
│   │   ├── InsightCard.tsx
│   │   ├── MonthlyReflection.tsx
│   │   ├── BudgetDeviationList.tsx
│   │   └── MoneyValue.tsx
│   │
│   ├── charts/
│   │   ├── FinancialEvolutionChart.tsx
│   │   ├── BudgetChart.tsx
│   │   └── chart-theme.ts
│   │
│   └── ui/
│
├── styles/
│   ├── globals.css
│   └── tokens.css
│
└── lib/
    ├── format-currency.ts
    ├── format-percentage.ts
    └── financial-status.ts
```

---

# 33. Ordem de migração

A migração deve ser incremental.

## Etapa 1 — Fundação

- [ ] Instalar/configurar shadcn/ui
- [ ] Adicionar Inter
- [ ] Adicionar DM Sans
- [ ] Criar tokens CSS
- [ ] Configurar Tailwind
- [ ] Configurar radius
- [ ] Configurar cores semânticas
- [ ] Adicionar assets

---

## Etapa 2 — Componentes básicos

- [ ] Button
- [ ] Card
- [ ] Input
- [ ] Select
- [ ] Badge
- [ ] Alert
- [ ] Tabs
- [ ] Tooltip
- [ ] Skeleton
- [ ] Dialog
- [ ] Sheet
- [ ] Separator

---

## Etapa 3 — Layout

- [ ] AppShell
- [ ] Sidebar
- [ ] Header
- [ ] PageHeader
- [ ] MonthNavigator
- [ ] Responsividade

---

## Etapa 4 — Componentes financeiros

- [ ] MoneyValue
- [ ] KpiCard
- [ ] InsightCard
- [ ] BudgetDeviationList
- [ ] FinancialEvolutionChart
- [ ] MonthlyReflection

---

# 34. Primeira tela a migrar

Migrar primeiro a tela:

```text
Reflexão Kakebo
```

Motivos:

- já possui KPIs;
- já possui insights;
- possui gráficos;
- representa bem a identidade;
- permite validar o design system.

---

# 35. Nova estrutura da tela Reflexão

```text
PageHeader
│
├── KPI Grid
│   ├── Receitas
│   ├── Despesas
│   ├── Resultado Real
│   └── Taxa de Poupança
│
├── Insights
│   ├── Orçamento
│   └── Sobrevivência
│
├── Analytics Grid
│   ├── Evolução financeira
│   └── Maiores desvios
│
└── Reflexão mensal
```

---

# 36. Desktop alvo

A largura útil deve ficar aproximadamente entre:

```text
1180px
e
1440px
```

Evitar que os cards fiquem excessivamente largos em monitores grandes.

Utilizar:

```tsx
<div className="mx-auto w-full max-w-[1440px]">
```

---

# 37. Cards KPI — Grid

```tsx
<div className="
  grid
  gap-4
  sm:grid-cols-2
  xl:grid-cols-4
">
```

---

# 38. Analytics Grid

```tsx
<div className="
  grid
  gap-6
  xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]
">
```

---

# 39. Estados de interação

Todo componente interativo deve possuir:

```text
default
hover
active
focus-visible
disabled
loading
```

O Codex não deve implementar apenas o estado visual padrão.

---

# 40. Migração sem quebra funcional

Não alterar simultaneamente:

```text
UI
+
regra de negócio
+
API
```

durante a primeira etapa.

Primeiro:

```text
mesmos dados
mesma API
novo visual
```

Depois refatorar lógica se necessário.

---

# 41. Evitar

Não fazer:

- gradientes fortes;
- verde neon;
- glassmorphism;
- sombras pesadas;
- muitas cores no mesmo card;
- ícones ilustrativos grandes;
- arredondamento exagerado;
- animações longas;
- aparência bancária;
- aparência infantil;
- textura de papel em todos os elementos.

---

# 42. Microinterações

Permitido:

```text
150–250ms
```

Exemplos:

- hover de cards;
- hover de sidebar;
- barra de progresso;
- entrada dos gráficos;
- expansão de menu.

Usar:

```css
transition-colors duration-200
```

e:

```css
transition-all duration-200
```

com moderação.

---

# 43. Checklist para validação visual

- [ ] A interface parece mais calma que a versão atual
- [ ] O verde não domina excessivamente
- [ ] Terracota é usada principalmente para alertas e despesas
- [ ] Azul aparece apenas como apoio
- [ ] Cards possuem espaçamento consistente
- [ ] A sidebar possui hierarquia clara
- [ ] Os gráficos utilizam a mesma paleta do design system
- [ ] Tipografia é consistente
- [ ] Valores monetários possuem boa legibilidade
- [ ] Mobile funciona sem scroll horizontal
- [ ] Estados negativos não dependem apenas de cor
- [ ] Componentes reutilizáveis substituem implementações duplicadas

---

# 44. Critérios de aceite da primeira fase

A primeira fase estará concluída quando:

- [ ] tokens estiverem centralizados;
- [ ] sidebar estiver migrada;
- [ ] tela Reflexão estiver migrada;
- [ ] todos os KPIs utilizarem `KpiCard`;
- [ ] insights utilizarem `InsightCard`;
- [ ] gráfico utilizar tokens globais;
- [ ] tela for responsiva;
- [ ] não houver regressão nas funcionalidades atuais;
- [ ] Lighthouse Accessibility estiver >= 90;
- [ ] não existirem cores financeiras hardcoded dentro das páginas.

---

# 45. Prompt recomendado para o Codex

Utilizar este plano como contexto e executar em etapas pequenas.

```text
Implemente a nova identidade visual do Kakebo seguindo o arquivo
PLANO_IMPLEMENTACAO_IDENTIDADE_KAKEBO.md.

Regras:

1. Não altere regras de negócio nesta etapa.
2. Preserve as APIs e contratos existentes.
3. Use shadcn/ui sempre que existir um componente equivalente.
4. Use Tailwind para estilização.
5. Centralize cores e tokens no tema.
6. Não coloque hex colors diretamente nas páginas.
7. Use DM Sans em títulos e Inter na interface.
8. Crie componentes reutilizáveis antes de modificar as telas.
9. Comece pela infraestrutura visual e depois migre a tela Reflexão Kakebo.
10. Garanta responsividade.
11. Garanta estados hover, focus, disabled e loading.
12. Não remova nenhuma funcionalidade existente.
13. Ao final de cada etapa, execute lint, typecheck e testes existentes.
14. Mostre um resumo dos arquivos alterados e do que foi implementado.
```

---

# 46. Sequência sugerida para o Codex

## Prompt 1

```text
Analise a estrutura atual do frontend e identifique framework, Tailwind,
biblioteca de componentes e organização de estilos.

Não altere arquivos ainda.

Depois proponha o mapeamento deste projeto para o design system descrito em
PLANO_IMPLEMENTACAO_IDENTIDADE_KAKEBO.md.
```

## Prompt 2

```text
Implemente somente a fundação do novo design system:

- tokens;
- cores;
- fontes;
- radius;
- shadow;
- configuração shadcn/ui.

Não altere páginas ainda.
```

## Prompt 3

```text
Implemente:

- KakeboLogo;
- AppShell;
- AppSidebar;
- PageHeader;
- MonthNavigator.

Migre somente o layout global para utilizar esses componentes.
```

## Prompt 4

```text
Crie os componentes:

- MoneyValue;
- KpiCard;
- InsightCard;
- BudgetDeviationList.

Não altere a regra de negócio.
```

## Prompt 5

```text
Migre a página Reflexão Kakebo para o novo design system.

Use exclusivamente os componentes reutilizáveis criados anteriormente.

Preserve os dados e comportamentos atuais.
```

## Prompt 6

```text
Revise a página Reflexão Kakebo em desktop, tablet e mobile.

Corrija:
- espaçamentos;
- overflow;
- contraste;
- acessibilidade;
- estados de interação.

Não altere regras financeiras.
```

---

# Resultado esperado

A aplicação deve manter a estrutura funcional que o Kakebo já possui, mas passar a transmitir uma identidade própria:

> **menos dashboard financeiro genérico e mais ferramenta de planejamento e reflexão financeira.**

A experiência deve combinar:

```text
clareza de dashboard
+
organização de caderno
+
reflexão do método Kakebo
+
consistência de design system
```

A prioridade não é decorar a interface, mas criar uma base visual consistente que possa ser reutilizada em todo o produto.
