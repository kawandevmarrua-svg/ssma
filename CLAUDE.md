# CLAUDE.md — Marrua App

## Visão geral
App de gestão de segurança operacional. Monorepo npm workspaces com dois produtos:
- **Mobile** (`apps/mobile/`): Expo (React Native) — app para operadores em campo
- **Web** (`apps/web/`): Next.js 15 — dashboard para gestores/admin, deployed na Vercel
- **Shared** (`packages/shared/`): tipos do banco + schemas zod compartilhados (`@marrua/shared`)

Backend: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)

---

## Estrutura

```
/
├── package.json             # raiz: workspaces + scripts (db:*, test, typecheck)
├── apps/
│   ├── mobile/              # Expo app
│   │   ├── app/
│   │   │   ├── (auth)/      # login, splash, reset-password
│   │   │   └── (operator)/  # telas do operador (checklist, equipe, servico...)
│   │   ├── src/
│   │   │   ├── contexts/AuthContext.tsx
│   │   │   ├── lib/supabase.ts
│   │   │   ├── lib/         # locationTask, offlineQueue, reminders...
│   │   │   ├── hooks/, components/, theme/
│   │   │   ├── types/database.ts   # stub → re-exporta @marrua/shared
│   │   │   └── schemas/index.ts    # stub → re-exporta @marrua/shared
│   │   └── android/, app.json, eas.json, metro.config.js
│   └── web/                 # Next.js dashboard
│       └── src/app/
│           ├── (dashboard)/ # checklists, maquinas, inspecao-comportamental, mapa...
│           └── login/
├── packages/
│   └── shared/              # @marrua/shared
│       ├── src/types/database.ts   # FONTE CANÔNICA dos tipos do DB
│       └── src/schemas/index.ts    # schemas zod (+ testes vitest)
└── supabase/
    ├── migrations/          # NUNCA editar migrations existentes, sempre criar nova
    ├── config.toml          # config do ambiente local (Docker) — portas 5532x
    └── functions/           # Edge Functions (Deno)
```

---

## Roles (profiles.role)
- `admin` — acesso total
- `manager` — acesso total (equivalente a admin na maioria das políticas)
- `encarregado` — supervisor de campo, vê equipe e checklists
- `operator` / usuário autenticado — acesso ao próprio conteúdo

---

## Comandos (rodar na RAIZ do monorepo)

```bash
npm install            # instala tudo (workspaces, lockfile único na raiz)
npm run mobile         # expo start
npm run web            # next dev
npm run typecheck      # tsc em todos os workspaces
npm test               # vitest (packages/shared)
```

### Supabase local (Docker — precisa do Docker Desktop rodando)
```bash
npm run db:start       # sobe Postgres/Auth/Storage/Studio local (portas 55321-55329)
npm run db:status      # mostra URLs e chaves locais
npm run db:reset       # recria banco local aplicando TODAS as migrations
npm run db:stop        # derruba containers
npm run db:types       # regenera packages/shared/src/types/database.ts do banco LOCAL
```
Studio local: http://127.0.0.1:55323
Portas 5532x (e não as padrão 5432x): o Windows reserva o range 54249-54348 (WinNAT) e bloqueia bind nas portas padrão.

Seed local (`supabase/seed.sql`, roda no `db:reset`): grants de paridade com o remoto + usuários admin@local.dev/Admin123!, encarregado@local.dev/Chefe123!, operador@local.dev/Operar123! + 2 máquinas. Edge functions locais leem `supabase/functions/.env`.

### Web em container (prod-like)
```bash
docker compose up -d --build web   # http://localhost:3005 (3000 ocupada por outro projeto)
```
Split-horizon: browser usa NEXT_PUBLIC_SUPABASE_URL (127.0.0.1:55321); o server dentro do container usa a env `SUPABASE_URL` (host.docker.internal:55321) — override implementado em `apps/web/src/lib/supabase/{server,middleware}.ts` e `usuarios/actions.ts`.

### Mobile
```bash
cd apps/mobile
npx expo prebuild --clean       # regenerar android/
npx expo run:android            # build nativo
eas build --profile production --platform android   # release EAS
```

### Deploy / release
```bash
npx supabase db push   # aplica migrations no remoto (ou npm run db:push)
# Web: push na master → Vercel (Root Directory = apps/web)
# Android: tag v* → GitHub Actions builda APK, ou EAS
```

---

## Fluxo de teste local (antes de release)
1. `npm run db:start` + `npm run db:reset` — banco local com todas as migrations
2. `apps/web/.env.local` apontando para local (copiar de `.env.local.example`)
3. `npm run web` — testar dashboard contra banco local
4. Mobile: `.env` com `http://10.0.2.2:55321` (emulador) ou IP da máquina (device físico)
5. `npm run typecheck` + `npm test`
6. Só então: `db:push` + push master + build Android

---

## Variáveis de ambiente

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Local: `apps/web/.env.local.example` tem os valores do Supabase local.

---

## Banco de dados — tabelas principais
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários com roles |
| `machines` | Equipamentos |
| `checklists` | Pré-operação por operador |
| `checklist_responses` | Respostas dos itens |
| `behavioral_inspections` | Inspeções comportamentais (todos autenticados podem inserir) |
| `behavioral_inspection_items` | Itens da inspeção |
| `behavioral_deviations` | Desvios encontrados |
| `activities` | Atividades de trabalho |
| `alerts` | Alertas do sistema |
| `maintenance_orders` | Ordens de manutenção |
| `operator_locations` | Localização em tempo real |

---

## Convenções
- Migrations: sempre nova, nunca editar existente. Prefixo `YYYYMMDDHHMMSS_`.
- RLS sempre ativa em todas as tabelas.
- Tipos do DB: fonte única em `packages/shared/src/types/database.ts` (regenerar com `npm run db:types`). Os stubs em `apps/mobile/src/types` e schemas apenas re-exportam.
- Mobile usa `apps/mobile/src/lib/supabase.ts`. Web usa `apps/web/src/lib/supabase/`.
- React 19.2 alinhado nos dois apps; TypeScript ~5.9 em todo o monorepo.
- App mobile: `package com.checklist.app`, versão gerenciada pelo EAS (`appVersionSource: remote`).
- Lockfile único na raiz (`package-lock.json`). Nunca criar lockfile dentro de apps/.

## Deploy
- **Vercel**: push para `master` dispara build do web (Root Directory: `apps/web`).
- **Android**: tag `v*` (GitHub Actions) ou `eas build --profile production`.
- **Migrations**: `npm run db:push` após cada push com novas migrations.
