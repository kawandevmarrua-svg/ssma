# Ações pendentes — pós-migração para monorepo (2026-08-25)

Checklist do que falta fazer manualmente depois da reestruturação
(monorepo npm workspaces + Supabase local via Docker).

## 1. Vercel — Root Directory (CRÍTICO, antes do próximo push)
No painel da Vercel: **Settings → Build & Deployment → Root Directory** = `apps/web`.
Sem isso o próximo deploy quebra, porque o Next.js não está mais na raiz do repo.

## 2. Histórico de migrations remoto (antes do próximo `db push`)
As migrations legadas `001`–`005` foram renomeadas com timestamps.
Antes do próximo `npm run db:push`:

```bash
npx supabase login
npx supabase migration list   # compara histórico local x remoto
```

Se o remoto listar `001`–`005`, reparar o histórico:

```bash
npx supabase migration repair --status reverted 001 002 003 004 005
npx supabase migration repair --status applied 20260425183502 20260425183503 20260425183504 20260425191000 20260425192000
```

As duas migrations novas de reparo (`20260429020000_add_profiles_created_by`,
`20260430005000_add_profiles_active`) são idempotentes — no remoto viram no-op,
pode deixar o `db push` aplicá-las normalmente.

## 3. Expo — primeira execução após a mudança
```bash
npm run mobile          # se der erro de cache/resolução:
cd apps/mobile
npx expo start -c       # limpa cache do Metro
npx expo prebuild --clean   # só se o build nativo reclamar de paths
```

## 4. Testar o mapa no dashboard
`react-leaflet` subiu de v4 para v5 (junto com React 18 → 19).
API é a mesma, mas conferir visualmente a tela `/mapa` rodando `npm run web`.

## 5. Commit da migração
Nada foi commitado ainda (~244 mudanças, maioria renames preservando histórico).

```bash
git status              # revisar
git add -A
git commit              # ou pedir pro Claude commitar
```

## Referência rápida — ambiente local
| Serviço | URL |
|---------|-----|
| API Supabase local (REST/Auth/Storage/Functions) | http://127.0.0.1:55321 |
| Studio | http://127.0.0.1:55323 |
| Mailpit (emails) | http://127.0.0.1:55324 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:55322/postgres |
| Dashboard web em container (prod-like) | http://localhost:3005 |

- Subir/derrubar backend: `npm run db:start` / `npm run db:stop`
- Recriar banco com migrations + seed: `npm run db:reset`
- Dashboard containerizado: `docker compose up -d --build web` (dev com hot reload continua sendo `npm run web` na porta 3000... se livre — o attendance_frontend ocupa a 3000)
- Chaves locais: `npm run db:status` (ou `apps/web/.env.local.example`)
- Portas são 5532x (não 5432x): Windows reserva o range 54249–54348 (WinNAT)

## Usuários seed (só existem no banco LOCAL)
| Email | Senha | Role |
|-------|-------|------|
| admin@local.dev | Admin123! | admin |
| encarregado@local.dev | Chefe123! | encarregado |
| operador@local.dev | Operar123! | operator |

Também são seedadas 2 máquinas de exemplo (ESC-001, GUI-001).
Edge functions locais leem env de `supabase/functions/.env` (ALLOWED_ORIGINS, INTERNAL_FUNCTION_SECRET).
