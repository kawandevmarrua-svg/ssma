# SSMA Smart Vision

Plataforma completa de gestao de **Seguranca, Saude e Meio Ambiente (SSMA)** com visao 360 das operacoes. Composta por um **app mobile** para operadores em campo e um **painel web** para gestores.

---

## Visao Geral

O SSMA Smart Vision digitaliza todo o fluxo de seguranca operacional: desde a inspecao pre-uso de maquinas ate o acompanhamento de indicadores em tempo real. Substitui planilhas e formularios em papel por um sistema integrado, auditavel e rastreavel.

### App Mobile (Android)

Aplicativo desenvolvido em **React Native + Expo** para uso direto pelos operadores em campo.

**Funcionalidades:**

- Checklist pre-uso com leitura de **QR Code** da maquina
- Itens de inspecao configurados por maquina (sim/nao, texto, numerico, foto)
- **4 fotos obrigatorias** do equipamento + 1 foto do ambiente
- Resultado automatico: **Liberado** ou **Nao Liberado** (itens impeditivos)
- Pre-operacao com 12 perguntas de seguranca (incluindo itens criticos)
- Registro de atividades com local, descricao e fotos
- Finalizacao de atividades com registro de interferencias e translado
- **Alertas em tempo real** via push notification
- Perfil do operador com indicadores mensais (score, checklists, desvios)
- Funciona offline-first para areas com sinal limitado

**Telas do app:**

| Tela | Descricao |
|------|-----------|
| Inicio | Dashboard com status da pre-operacao, contadores do dia e acoes rapidas |
| Checklist | Lista de checklists, scanner QR, selecao manual, itens de inspecao, fotos e resultado |
| Atividades | Registro e acompanhamento de atividades do dia com fotos e pre-operacao |
| Alertas | Notificacoes de seguranca recebidas em tempo real |
| Perfil | Dados do operador, score mensal e logout |

### Painel Web (Dashboard)

Painel administrativo desenvolvido em **Next.js 15 + Tailwind CSS** para gestores e supervisores.

**Funcionalidades:**

- Dashboard com visao geral de checklists, atividades e alertas do dia
- Gestao de **operadores** (cadastro, cargos, status)
- Cadastro de **maquinas** com QR Code, tag e itens de checklist personalizados
- Visualizacao detalhada de **checklists** com fotos e respostas
- Acompanhamento de **atividades** dos operadores
- Sistema de **alertas de seguranca** com niveis de severidade
- **Indicadores** e KPIs de seguranca
- Gestao de **usuarios** do painel com controle de acesso
- Landing page publica com informacoes do sistema
- Barra de carregamento no topo (estilo YouTube) para navegacao fluida

---

## Tecnologias

| Camada | Stack |
|--------|-------|
| App Mobile | React Native, Expo Router, TypeScript |
| Painel Web | Next.js 15, Tailwind CSS, TypeScript |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| CI/CD | GitHub Actions (build APK), Vercel (deploy web) |

---

## Estrutura do Projeto

Monorepo npm workspaces:

```
ssma/
├── apps/
│   ├── mobile/             # App mobile (Expo)
│   │   ├── app/            # Telas (Expo Router): (auth)/, (operator)/
│   │   ├── src/            # components, contexts, hooks, lib, theme
│   │   └── android/        # Build Android nativo
│   └── web/                # Painel web (Next.js)
│       └── src/
│           ├── app/        # Rotas do painel
│           ├── components/ # Sidebar, Topbar, UI
│           └── lib/        # Supabase server/client
├── packages/
│   └── shared/             # @marrua/shared — tipos do DB + schemas zod
├── supabase/
│   ├── migrations/         # Migracoes do banco
│   ├── config.toml         # Ambiente local (Docker)
│   └── functions/          # Edge Functions
└── .github/workflows/      # CI/CD (typecheck, testes, build APK)
```

---

## Como Rodar

Instale tudo uma vez, na raiz:
```bash
npm install
```

### App Mobile
```bash
npm run mobile          # expo start
cd apps/mobile && npx expo run:android   # build Android local
```

### Painel Web
```bash
npm run web             # next dev — http://localhost:3000
```

### Backend local (Supabase via Docker)

Requer **Docker Desktop** rodando.

```bash
npm run db:start        # sobe Postgres, Auth, Storage e Studio locais
npm run db:reset        # aplica todas as migrations no banco local
npm run db:status       # mostra URLs e chaves locais
npm run db:stop         # derruba os containers
```

- API local: `http://127.0.0.1:55321` — Studio: `http://127.0.0.1:55323`
- Web: copie `apps/web/.env.local.example` para `apps/web/.env.local`
- Mobile (emulador Android): `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:55321`
- O `db:reset` também aplica o `supabase/seed.sql`: cria usuários de teste
  (`admin@local.dev` / `Admin123!`, `encarregado@local.dev` / `Chefe123!`,
  `operador@local.dev` / `Operar123!`) e 2 máquinas de exemplo.
- Edge Functions locais: env em `supabase/functions/.env` (veja `.env.example`).

### Dashboard em container (build de produção)

Testa o web como ele roda em produção, contra o Supabase local:

```bash
docker compose up -d --build web   # http://localhost:3005
```

Para desenvolvimento com hot reload continue usando `npm run web`.

### Testes e typecheck
```bash
npm test                # vitest (packages/shared)
npm run typecheck       # tsc em todos os workspaces
```

### Variaveis de Ambiente

**App Mobile** — crie `apps/mobile/.env` (veja `.env.example`):
```
EXPO_PUBLIC_SUPABASE_URL=sua_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

**Painel Web** — crie `apps/web/.env.local` (veja `.env.local.example` para local):
```
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

---

## Release

Fluxo recomendado — teste local primeiro, depois deploy:

```bash
# 1. Testar localmente contra o banco Docker
npm run db:start && npm run db:reset
npm run web            # e/ou npm run mobile
npm test && npm run typecheck

# 2. Aplicar migrations no Supabase remoto
npm run db:push

# 3. Web: push no master -> Vercel builda (Root Directory: apps/web)
git push origin master

# 4. Android: tag v* -> GitHub Actions gera o APK e cria a Release
git tag v1.0.6
git push origin v1.0.6
```

---

## Licenca

Todos os direitos reservados.
