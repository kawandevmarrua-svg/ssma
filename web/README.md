# Segurança em 360 — Painel Web

Painel de gestão (Next.js 14 + App Router) para administradores, gestores e SSMA. Compartilha o mesmo Supabase do app mobile.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** + utilitários no padrão shadcn/ui
- **Supabase SSR** (auth via cookies, middleware de sessão)
- **lucide-react** (ícones)

## Como rodar

```bash
cd web
npm install
cp .env.example .env.local   # já existe um .env.local com as credenciais atuais
npm run dev
```

Acesse `http://localhost:3000`. Sem sessão, o middleware redireciona para `/login`.

## Estrutura

```
web/
├── src/
│   ├── app/
│   │   ├── login/                ← Tela de login (Supabase Auth)
│   │   ├── (dashboard)/          ← Rotas protegidas (sidebar + topbar)
│   │   │   ├── layout.tsx        ← Layout base autenticado
│   │   │   ├── dashboard/
│   │   │   ├── operadores/
│   │   │   ├── templates/
│   │   │   ├── checklists/
│   │   │   ├── atividades/
│   │   │   ├── alertas/
│   │   │   ├── inspecoes/
│   │   │   ├── indicadores/
│   │   │   └── configuracoes/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              ← Redireciona para /dashboard
│   ├── components/
│   │   ├── ui/                   ← button, input, label, card
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── placeholder-page.tsx
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts         ← Browser client
│       │   ├── server.ts         ← Server Components / actions
│       │   └── middleware.ts     ← Refresh de sessão + guards
│       └── utils.ts
├── middleware.ts                 ← Redireciona não autenticados
├── tailwind.config.ts
└── next.config.js
```

## Status (Fase 2 do plano em `mudança.md`)

- [x] Projeto Next.js criado
- [x] Conexão com o mesmo Supabase do mobile
- [x] Auth via Supabase (login + logout + middleware)
- [x] Layout base (sidebar + topbar) e rotas placeholder
- [ ] Implementação real das páginas de gestão (Fases 3+)
