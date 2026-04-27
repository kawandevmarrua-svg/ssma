# Seguranca - Acoes Aplicadas e Pendentes

Resumo das correcoes feitas e itens que precisam de acao **manual** no Supabase Dashboard ou no provedor de hosting (Vercel/EAS).

---

## Aplicado no codigo

- `.gitignore` (root + `web/`) agora bloqueia qualquer `.env*` exceto `.env.example`.
- Migration `20260426190000_security_hardening_v2.sql`:
  - Trigger `prevent_operator_sensitive_updates` impede mudancas em `auth_user_id`, `created_by`, `email`, `role` por nao-admin.
  - Trigger `restrict_safety_alert_updates` impede operador de alterar metadados de alertas (so pode atualizar `response_*`).
  - Garante RLS habilitado em `safety_alerts`.
  - Define `file_size_limit` (5 MB) e `allowed_mime_types` (jpeg/png/heic/webp) em `checklist-photos`, `activity-photos`, `inspection-photos`.
- Edge function `create-operator` e Server Action `createUserAction` marcam `must_reset_password: true` no `user_metadata` (preparacao para forcar reset no primeiro login).
- Mensagens de erro no UI sanitizadas (sem vazar `error.message` cru do PostgREST).
- `babel-plugin-transform-remove-console` em prod (mobile) — remove `console.*` do bundle de release.

---

## Acoes manuais OBRIGATORIAS

### 1. Rotacionar chaves Supabase (URGENTE)

Tanto a `ANON_KEY` quanto a `SERVICE_ROLE_KEY` foram lidas em texto claro durante a auditoria. Trate ambas como comprometidas.

1. Supabase Dashboard → Settings → API.
2. Reset `service_role` key. Atualize:
   - `web/.env.local` (`SUPABASE_SERVICE_ROLE_KEY`)
   - Variavel de ambiente em Vercel / host de prod
   - Secrets das Edge Functions (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`)
3. Reset `anon` key (opcional, menor impacto). Atualize:
   - `.env` (`EXPO_PUBLIC_SUPABASE_ANON_KEY`)
   - `web/.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Rebuild mobile (EAS) e redeploy web.

### 2. Aplicar a nova migration

```
supabase db push
```

ou aplique manualmente o SQL `supabase/migrations/20260426190000_security_hardening_v2.sql` no SQL Editor.

### 3. Configurar secrets das Edge Functions

```
supabase secrets set INTERNAL_FUNCTION_SECRET=<hex aleatorio 64 chars>
supabase secrets set ALLOWED_ORIGINS=https://painel.suaempresa.com.br,http://localhost:3000
```

E configurar no banco para a trigger `dispatch_push_notification`:
```sql
alter database postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
alter database postgres set app.settings.service_role_key = '<service_role>';
alter database postgres set app.settings.internal_function_secret = '<mesmo valor do secret>';
```

### 4. Habilitar CAPTCHA no Supabase Auth

Dashboard → Authentication → Providers → Email → habilite CAPTCHA (hCaptcha ou Cloudflare Turnstile). Adicione o token no client (`signInWithPassword({ email, password, options: { captchaToken } })`).

### 5. Politica de senha server-side

Dashboard → Authentication → Policies:
- Minimum password length: 10
- Require letters/numbers/symbols
- Leaked password protection: ON

### 6. Auth rate limit

Dashboard → Authentication → Rate Limits:
- Sign-in attempts: 5/min por IP (default 30 e folgado)

### 7. (Opcional) Migrar para invite-by-email

Hoje o admin define a senha inicial. Para eliminar a senha do payload:
1. Substituir `admin.createUser({ email, password })` por `admin.inviteUserByEmail(email)`.
2. Remover input de senha do formulario de criacao de usuario (mobile + web).
3. Configurar template de e-mail "Invite user" em Auth → Email Templates.

### 8. Lockfile mobile

Rodar `npm install` na raiz e commitar o `package-lock.json` para builds determinsiticos.

### 9. Revisao periodica

- Auditar usuarios `pending` toda semana (ninguem deveria ficar nesse estado).
- Rotacionar `INTERNAL_FUNCTION_SECRET` a cada 6 meses.
- Rodar `npm audit --production` no CI.

---

## Itens de baixa prioridade ainda em aberto

- B1 — adicionar `package-lock.json` mobile.
- B2 — remover `aes-js` do `package.json` (nao usado).
- B7 — `Cache-Control: no-store` em rotas autenticadas Next.
- A2 (parcial) — invite-by-email completo (item 7 acima).
- M3 — restringir CORS para nao aceitar requests sem `Origin` (decidir caso a caso).
