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

Painel administrativo desenvolvido em **Next.js 14 + Tailwind CSS** para gestores e supervisores.

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
| Painel Web | Next.js 14, Tailwind CSS, TypeScript |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| CI/CD | GitHub Actions (build APK), Vercel (deploy web) |

---

## Estrutura do Projeto

```
ssma/
├── app/                    # Telas do app mobile (Expo Router)
│   ├── (admin)/            # Telas admin no mobile
│   ├── (auth)/             # Login
│   └── (operator)/         # Telas do operador
├── src/                    # Codigo compartilhado do mobile
│   ├── components/         # Componentes reutilizaveis
│   ├── contexts/           # AuthContext
│   ├── lib/                # Supabase client, utils
│   ├── theme/              # Cores e estilos
│   └── types/              # Tipos TypeScript
├── web/                    # Painel web (Next.js)
│   └── src/
│       ├── app/            # Rotas do painel
│       ├── components/     # Sidebar, Topbar, UI
│       └── lib/            # Supabase server/client
├── supabase/
│   ├── migrations/         # Migracoes do banco
│   └── functions/          # Edge Functions
├── android/                # Build Android nativo
└── .github/workflows/      # CI/CD (build APK)
```

---

## Como Rodar

### App Mobile

```bash
npm install
npx expo start
```

Para build Android local:
```bash
npx expo run:android
```

### Painel Web

```bash
cd web
npm install
npm run dev
```

Acesse `http://localhost:3000`

### Variaveis de Ambiente

**App Mobile** — crie `.env` na raiz:
```
EXPO_PUBLIC_SUPABASE_URL=sua_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

**Painel Web** — crie `web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

---

## Deploy

- **Web:** Deploy automatico na Vercel a cada push no `master`
- **Android APK:** Build automatico via GitHub Actions ao criar tag `v*`

Para gerar uma nova release do APK:
```bash
git tag v1.0.1
git push origin v1.0.1
```

---

## Licenca

Todos os direitos reservados.
