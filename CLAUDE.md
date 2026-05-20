# CLAUDE.md — Marrua App

## Visão geral
App de gestão de segurança operacional. Dois produtos:
- **Mobile** (`/`): Expo (React Native) — app para operadores em campo
- **Web** (`/web/`): Next.js 15 — dashboard para gestores/admin, deployed na Vercel

Backend: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)

---

## Estrutura

```
/                        # Expo mobile app (React Native)
├── app/
│   ├── (auth)/          # login, splash, reset-password
│   └── (operator)/      # telas do operador (checklist, equipe, servico, etc.)
├── src/
│   ├── contexts/AuthContext.tsx
│   ├── lib/supabase.ts  # Supabase client
│   ├── lib/             # locationTask, offlineQueue, reminders, trackingEvents...
│   ├── hooks/           # useLocationTracking, useOfflineQueueSize...
│   ├── components/      # AppHeader, ErrorBoundary, modais...
│   └── types/database.ts  # tipos gerados do DB
├── supabase/
│   ├── migrations/      # NUNCA editar migrations existentes, sempre criar nova
│   └── functions/       # Edge Functions (Deno)
│       ├── calculate-operator-score/
│       ├── create-operator/
│       ├── delete-auth-user/
│       ├── generate-report/
│       └── notify-blocking-item/
└── web/                 # Next.js dashboard
    └── src/app/
        ├── (dashboard)/ # checklists, maquinas, inspecao-comportamental, mapa...
        └── login/
```

---

## Roles (profiles.role)
- `admin` — acesso total
- `manager` — acesso total (equivalente a admin na maioria das políticas)
- `encarregado` — supervisor de campo, vê equipe e checklists
- `operator` / usuário autenticado — acesso ao próprio conteúdo

---

## Comandos

### Mobile
```bash
# Dev (Expo Go)
npm start

# Build nativo Android
npx expo prebuild --clean
npx expo run:android

# EAS Build produção
eas build --profile production --platform android
```

### Web
```bash
cd web
npm run dev    # local dev (Next.js)
npm run build  # build produção
```

### Supabase
```bash
# Aplicar migrations no remoto
npx supabase db push

# Login CLI
npx supabase login --token <token>

# Novas migrations: criar arquivo com timestamp
# supabase/migrations/YYYYMMDDHHMMSS_descricao.sql
```

---

## Variáveis de ambiente

### Mobile (`/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Web (`/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

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
- Mobile usa `src/lib/supabase.ts`. Web usa `web/src/lib/supabase/`.
- Tipos DB gerados em `src/types/database.ts` (mobile) e `web/src/lib/types.ts` (web).
- App mobile: `package com.checklist.app`, versão gerenciada pelo EAS (`appVersionSource: remote`).

---

## Deploy
- **Vercel**: push para `master` dispara build automático do web dashboard.
- **Android**: via EAS (`eas build --profile production`).
- **Migrations**: rodar `npx supabase db push` após cada push com novas migrations.
