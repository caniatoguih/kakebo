# Fase 7 do frontend — Desempenho e resiliência da PWA

## Estado

Concluída.

## Primeiro bloco

- Registro explícito do service worker com atualização solicitada ao usuário.
- Aviso persistente quando o dispositivo fica offline.
- Bloqueio local de alterações financeiras sem conexão, antes de chamar a API.
- Política `NetworkOnly` para `/api`, evitando respostas financeiras antigas no cache do service worker.
- Limpeza automática de caches de versões anteriores e fallback offline para a aplicação.
- Gráfico do painel carregado somente quando há dados mensais para comparar.
- Importadores CSV e OFX carregados somente quando o menu Importar é aberto.
- Ícones do manifesto ajustados para assets que existem no build.

## Linha de base e primeira validação

- Comparação inicial dos chunks:
  - Dashboard: 366,59 kB → 12,30 kB; gráfico isolado em 354,86 kB.
  - Fluxo de Caixa: 75,03 kB → 32,94 kB.
  - Importador CSV isolado em 21,28 kB.
  - Importador OFX isolado em 23,09 kB.
- Limites automáticos adicionados ao CI para entrada principal, CSS, Dashboard e Fluxo de Caixa.

## Validação final

- E2E de produção aprovado em desktop e mobile: service worker instalado, shell recarregado offline, aviso preservado e reconexão confirmada.
- Ação “Verificar conexão” adicionada como recuperação quando o navegador não emitir o evento `online`.
- Recharts substituído por comparação leve, responsiva e acessível:
  - gráfico: 354,86 kB → 1,94 kB;
  - 37 pacotes transitivos removidos;
  - precache da PWA: 1.164,48 KiB → 819,97 KiB.
- Particionamento automático do Vite preservado após o budget agregado detectar que chunks manuais aumentavam o primeiro carregamento.
- Budget do CI passou a medir recursivamente o JavaScript inicial pelo manifesto do Vite e o tamanho agregado de todos os assets.
- 18 testes de componentes, lint, build PWA e budgets aprovados no Docker.
