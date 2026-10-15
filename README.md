# Simulador de Aposentadoria

Next.js (App Router) + TypeScript strict + Drizzle/**Supabase Postgres** (`postgres-js`) + Auth.js.

## A lógica
Quanto tenho investido hoje + quanto aporto por mês, rendendo a uma taxa de juros até os **60 ou 65 anos** — e quanto isso paga de renda, somado ao **INSS de um salário mínimo a partir dos 65**.

- Tudo em **R$ de hoje**: a taxa nominal vira taxa real descontando a inflação (`(1+taxa)/(1+inflação) − 1`); o aporte é considerado corrigido pela inflação.
- Aporte no **fim** do mês; saque no **início** do mês.
- Renda em duas versões: **só dos juros** (o patrimônio fica intacto) e **consumindo o patrimônio** até a idade escolhida.
- Impostos não são calculados — informe a taxa líquida de IR. Os atalhos de taxa (Poupança, CDI, Pré, IPCA+) são exemplos editáveis.
- Salário mínimo e inflação padrão ficam em `lib/plan.ts` (`MINIMUM_WAGE`, `DEFAULT_INFLATION`) — atualizar todo ano.

Cálculo: `lib/simulator.ts` (funções puras). Plano e validação (Zod): `lib/plan.ts`.

## Telas
`/dashboard` (meu plano: 60 × 65) · `/simulador` (testar variações, salvar como plano ou como cenário) · `/comparar` (2 a 3 cenários lado a lado).
`/demo?view=simulador|comparar` mostra as telas com dados fictícios, sem login nem banco (em produção só com `ENABLE_DEMO=1`).

## Comandos
`npm run test` · `npm run typecheck` · `npm run lint` · `npm run e2e` · `npm run db:generate` · `npm run db:migrate`

## Testes
`npm test` (Vitest: cálculo, plano e integração com Postgres real em memória via PGlite, incluindo a conversão do modelo antigo).
`npm run e2e` (Playwright sobre `/demo`; `PW_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` se o Chromium do Playwright não estiver instalado).

## Banco (Supabase)
Tabelas do app: `plans` (um plano por usuário) e `scenarios` (cenários salvos), mais as do Auth.js. Todas com **RLS** ativado sem políticas: a API pública do Supabase fica sem acesso; só o servidor do app lê/grava, sempre filtrando por `user_id`.

1. `cp .env.example .env` e preencha `DATABASE_URL` (Transaction pooler, 6543) e `DIRECT_URL` (Session pooler, 5432).
2. `npm run db:migrate`.
3. Na Vercel, defina `DATABASE_URL` (a do pooler transacional) e as demais variáveis do `.env.example`.

**Modelo antigo:** as tabelas do motor anterior (carteira, metas de gasto, premissas, acompanhamento…) continuam no banco, declaradas em `db/legacy-schema.ts`, mas o app não as usa mais — a migration `0004` converteu os planos para `plans`. Para apagá-las, remova as definições desse arquivo e rode `npm run db:generate`.
