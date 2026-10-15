# Simulador e Gestor de Aposentadoria

Next.js (App Router) + TypeScript strict + Drizzle/Postgres + Auth.js. Todos os valores do motor são **reais (R$ de hoje)**; o nominal é derivado por `valor × (1+inflação)^(meses/12)`.

## Comandos
`npm run test` · `npm run typecheck` · `npm run lint` · `npm run db:generate` · `npm run db:migrate` · `npm run db:seed`

## Motor (`lib/engine/`)
Funções puras, sem I/O. `parseSimulationInput` (Zod) → `runSimulation` → `SimulationResult`.
Convenções: aporte no **fim** do mês; saque no **início** do mês, rendimento sobre o que sobra.

### Decisões de modelagem (revisar!)
- Cálculo em `number` (double) dentro do motor; `decimal.js` só na fronteira com o banco (`lib/money.ts`) — a bisseção e o Monte Carlo rodam milhares de simulações.
- Retornos da tabela de cenários são tratados como **já líquidos de custos**; `custo_anual` default 0 e é subtraído se informado.
- Alíquotas efetivas: renda fixa 15%, ações 15%, FIIs isentos, PGBL 10% sobre o total, VGBL 10% sobre o ganho (editável por classe).
- `preservar_capital`: saca no máximo o rendimento real do mês (sem erosão); `taxa_fixa`: X% a.a. do saldo, recalculado a cada 12 meses de retirada; ambos reportam meses com renda não atendida.
- `patrimonioNecessario`: VP dos saques brutos até o horizonte, descontado pelo retorno real médio ponderado da carteira projetada; IR estimado pela razão ganho/saldo na aposentadoria. (Preservar: perpetuidade do maior saque; taxa fixa: maior necessidade anual ÷ taxa.)
- `rendaSustentavel`: renda total mensal (R$ de hoje, na idade de aposentadoria) — fator sobre as metas de gasto por bisseção; rendas externas (INSS) permanecem fixas.
- Pausas também suspendem aportes extras.
- INSS: aproximação (média de todos os salários × (60% + 2% por ano acima de 20), entre mínimo e teto). Sempre conferir no Meu INSS/CNIS.
