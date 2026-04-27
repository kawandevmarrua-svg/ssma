# Plano de Mudanças — Segurança em 360 / Smart Vision

## Visão Geral

Separar o sistema em duas frentes:

- **Site Web (Next.js)** — Painel de gestão para administradores, gestores e equipe SSMA
- **App Mobile (Expo)** — Exclusivo para operadores em campo

Ambos compartilham o **mesmo Supabase** como backend (auth, banco, storage, realtime).

```
┌─────────────────────────────────────────────┐
│           SUPABASE (Backend Único)           │
│  Auth · Database · Storage · Realtime        │
│  Edge Functions (relatórios, push)           │
└──────────┬──────────────────┬────────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │   SITE WEB  │   │  APP MOBILE │
    │  (Next.js)  │   │   (Expo)    │
    │  Gestores   │   │  Operadores │
    │  SSMA       │   │             │
    └─────────────┘   └─────────────┘
```

---

## FASE 1 — Banco de Dados (Supabase)

### 1.1 Novas tabelas

#### `equipment_types` — Tipos de equipamento (29 tipos do PRO-040169)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| name | text | Ex: "Caminhão Basculante", "Escavadeira" |
| category | text | Ex: "caminhao", "escavadeira", "trator" |
| header_fields | jsonb | Campos do cabeçalho: Marca, Modelo, TAG, Horário, Capacidade |
| active | boolean | Se o tipo está ativo |
| created_at | timestamptz | Data de criação |

Seed inicial com os 29 tipos:
1. Guindaste Articulado
2. Caminhão Basculante
3. Caminhão Brook
4. Caminhão Carroceria
5. Caminhão Comboio
6. Caminhão Conjugado
7. Caminhão Hidrojateamento
8. Caminhão Hipervácuo
9. Caminhão Pipa
10. Caminhão Prancha
11. Caminhão Sucção
12. Caminhão Vassoura
13. Fora de Estrada
14. Escavadeiras
15. Escavadeira Anfíbia
16. Empilhadeira
17. Escráipers
18. Motoniveladoras
19. Pás Carregadeiras
20. Perfuratriz
21. Retroescavadeira
22. Tratores
23. Manipulador de Pneus
24. Manipulador Telescópico
25. Mini Carregadeira
26. Mini Escavadeira Hidráulica
27. Mini Escavadeira Mamute
28. Rolo Compactador
29. Rompedor

#### `checklist_template_items` — Itens de cada tipo de equipamento

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| equipment_type_id | uuid | FK → equipment_types |
| description | text | Ex: "Cinto de Segurança?" |
| is_blocking | boolean | Se é item impeditivo (NC bloqueia liberação) |
| section | text | Seção opcional (ex: "Sistema Hidráulico", "Geral") |
| order_index | int | Ordem de exibição |
| active | boolean | Se o item está ativo |
| created_at | timestamptz | Data de criação |

Seed inicial: todos os itens de cada uma das 29 planilhas do Excel PRO-040169.

#### `pre_operation_checks` — Verificação pré-operação (Smart Vision)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| operator_id | uuid | FK → operators |
| date | date | Data |
| checklist_fisico | boolean | Checklist físico preenchido? |
| prontos_preenchido | boolean | Prontos preenchido? |
| apto_operar | boolean | Está apto para operar? |
| conhece_limites | boolean | Conhece os limites do equipamento? |
| art_disponivel | boolean | ART disponível na frente de serviço? |
| liberacao_acesso | boolean | Necessita liberação de acesso? |
| pts_preenchida | boolean | PTS está preenchida? |
| local_adequado | boolean | Local adequado para a tarefa? |
| local_sinalizado | boolean | Local sinalizado ou em área controlada? |
| manutencao_valida | boolean | Manutenção do equipamento válida? |
| created_at | timestamptz | Data de criação |

#### Evolução da tabela `checklists` existente

Adicionar colunas:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| equipment_type_id | uuid | FK → equipment_types (tipo do equipamento) |
| pre_operation_id | uuid | FK → pre_operation_checks |
| brand | text | Marca do equipamento |
| model | text | Modelo |
| tag | text | TAG de identificação |
| shift | text | Turno |
| max_load_capacity | text | Capacidade máxima de carga |
| result | text | 'released' ou 'not_released' |
| inspector_signature | text | Nome/matrícula do responsável |

#### `checklist_responses` — Respostas dos itens (substituir checklist_items)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| checklist_id | uuid | FK → checklists |
| template_item_id | uuid | FK → checklist_template_items |
| status | text | 'C' (Conforme), 'NC' (Não Conforme), 'NA' (Não Aplicável) |
| photo_url | text | Foto de evidência (opcional) |
| notes | text | Observação do item |
| created_at | timestamptz | Data de criação |

#### `activities` — Registro de atividades diárias

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| operator_id | uuid | FK → operators |
| checklist_id | uuid | FK → checklists (opcional) |
| date | date | Data da atividade |
| equipment_tag | text | TAG do equipamento |
| location | text | Local da atividade |
| description | text | Descrição da atividade |
| start_time | timestamptz | Horário de início |
| end_time | timestamptz | Horário de término |
| equipment_photo_url | text | Foto do equipamento |
| start_photo_url | text | Foto de início |
| end_photo_url | text | Foto de término |
| had_interference | boolean | Houve interferência? |
| interference_notes | text | Detalhes da interferência |
| transit_start | timestamptz | Início do translado |
| transit_end | timestamptz | Término do translado |
| notes | text | Observações gerais |
| created_at | timestamptz | Data de criação |

Nota: um operador pode ter **múltiplas atividades por dia** (escavação, abertura de vala, regularização, etc.)

#### `behavioral_inspections` — Inspeção comportamental (SSMA via web)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| observer_id | uuid | FK → profiles (quem observou) |
| operator_id | uuid | FK → operators (observado) |
| date | date | Data |
| time | time | Hora |
| unit_contract | text | Unidade/Contrato |
| area | text | Área/Frente de trabalho |
| equipment | text | Equipamento |
| activity_type | text | Tipo de atividade |
| observation_type | text | 'routine', 'critical_activity', 'post_incident', 'deviation_followup', 'scheduled_audit' |
| overall_classification | text | 'safe', 'attention', 'critical' |
| safe_behavior_description | text | Comportamento seguro observado |
| photo_url | text | Foto/vídeo da câmera |
| created_at | timestamptz | Data de criação |

#### `behavioral_inspection_items` — Itens da inspeção comportamental

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| inspection_id | uuid | FK → behavioral_inspections |
| category | text | 'risk_perception', 'attitude', 'ppe', 'operation', 'communication', 'environment' |
| description | text | Descrição do item |
| status | text | 'sim', 'nao', 'na' |
| created_at | timestamptz | Data de criação |

Categorias e itens fixos:

**4.1 Percepção de Risco:**
- Demonstrou consciência dos riscos da atividade
- Realizou APR / análise de risco antes da atividade
- Conhece os limites operacionais do equipamento
- Identificou perigos no entorno

**4.2 Postura e Atitude:**
- Mantém atenção plena durante a atividade
- Não apresenta comportamento de pressa / excesso de confiança
- Segue orientações e procedimentos
- Demonstra responsabilidade com sua segurança e dos demais

**4.3 Uso de EPI:**
- Utiliza todos os EPIs obrigatórios
- EPIs em bom estado de conservação
- Uso correto dos EPIs durante toda a atividade

**4.4 Operação / Execução da Tarefa:**
- Realizou checklist do equipamento
- Opera dentro dos limites seguros
- Mantém distância segura de pessoas/equipamentos
- Segue padrão operacional definido
- Não improvisa

**4.5 Comunicação e Interação:**
- Comunicação clara com equipe
- Utiliza sinalização adequada (rádio, gestos, etc.)
- Interrompe atividade em caso de dúvida
- Aceita orientação / feedback

**4.6 Condições do Ambiente:**
- Área organizada e limpa
- Condições seguras de trabalho
- Ausência de interferências de risco
- Controle ambiental adequado (derramamento, poeira, etc.)

#### `behavioral_deviations` — Desvios identificados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| inspection_id | uuid | FK → behavioral_inspections |
| description | text | Descrição do desvio |
| risk_level | text | 'low', 'medium', 'high', 'critical' |
| immediate_action | text | 'verbal_guidance', 'activity_intervention', 'activity_stoppage', 'immediate_correction' |
| immediate_action_description | text | Descrição da ação imediata |
| corrective_action | text | Ação corretiva proposta |
| responsible | text | Responsável pela ação |
| deadline | date | Prazo |
| status | text | 'open', 'in_progress', 'completed' |
| created_at | timestamptz | Data de criação |

#### `operator_scores` — Score/indicadores do operador

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| operator_id | uuid | FK → operators |
| period | text | Ex: "2026-04" (mês/ano) |
| checklists_total | int | Total de checklists no período |
| checklists_done | int | Checklists realizados |
| inspections_total | int | Total de inspeções |
| inspections_done | int | Inspeções realizadas |
| deviations_count | int | Qtd de desvios |
| critical_deviations | int | Qtd de desvios críticos |
| productivity_index | decimal | Índice de produtividade |
| avg_operation_time | interval | Tempo médio de operação |
| interventions_count | int | Nº de intervenções |
| score | decimal | Score final calculado |
| calculated_at | timestamptz | Quando foi calculado |

### 1.2 RLS (Row Level Security)

- Gestores/Admin: leitura e escrita em tudo
- Operadores: leitura/escrita apenas nos próprios dados (checklists, atividades, alertas dirigidos a eles)
- SSMA: leitura/escrita em inspeções comportamentais

### 1.3 Storage Buckets

- `checklist-photos` (já existe) — fotos dos checklists
- `activity-photos` (novo) — fotos de atividades (equipamento, início, término)
- `inspection-photos` (novo) — fotos/vídeos das inspeções comportamentais

---

## FASE 2 — Site Web (Next.js) ✅ CONCLUÍDA (2026-04-26)

> **Status:** estrutura base implementada na pasta `web/`. As páginas de funcionalidade (templates, operadores, alertas, etc.) estão como placeholders e serão preenchidas nas fases seguintes.

### 2.1 Setup do projeto

- [x] Criar projeto Next.js (App Router) na pasta `web/` dentro do repositório
- [x] Conectar ao mesmo Supabase (mesmas credenciais — `.env.local` em `web/`)
- [x] Auth via Supabase (login de gestores/admin/SSMA) — usando `@supabase/ssr` com cookies
- [x] UI com Tailwind CSS + utilitários padrão shadcn/ui (button, input, label, card)
- [x] Middleware global redireciona não autenticados para `/login` e autenticados em `/login` para `/dashboard`
- [ ] Redirecionar operadores para o app mobile (regra de role será adicionada quando o banco da Fase 1 existir)

### 2.2 O que foi entregue

- `web/` na raiz do repositório, isolada do projeto Expo
- Login funcional (`/login`) com `signInWithPassword`
- Layout autenticado (`(dashboard)/layout.tsx`) com **Sidebar** + **Topbar** (logout)
- **Dashboard** (`/dashboard`) com cards de stats (placeholders) e roadmap visível
- Rotas placeholder das demais seções: operadores, templates, checklists, atividades, alertas, inspeções, indicadores, configurações
- Integração Supabase em três camadas: browser client, server client, middleware refresh
- README em `web/README.md` com instruções de execução

### 2.3 Como rodar

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

### 2.2 Páginas e funcionalidades

#### Dashboard (`/`)
- Cards resumo: operadores ativos, checklists hoje, alertas pendentes, desvios abertos
- Gráficos: checklists por dia (últimos 30 dias), desvios por tipologia, score médio
- Atividades recentes em tempo real

#### Operadores (`/operadores`)
- Lista de operadores com busca e filtros
- Cadastro/edição de operador
- Ver histórico completo: checklists, atividades, inspeções, score
- Ativar/desativar operador

#### Templates de Checklist (`/templates`)
- Lista dos 29 tipos de equipamento
- Visualizar itens de cada tipo
- Editar itens (adicionar, remover, reordenar)
- Marcar/desmarcar item como impeditivo
- Criar novo tipo de equipamento (futuro)
- Organizar itens por seção

#### Checklists Realizados (`/checklists`)
- Lista de todos os checklists preenchidos pelos operadores
- Filtros: por operador, equipamento, data, resultado (liberado/não liberado)
- Detalhe: ver cada item com status C/NC/NA e fotos
- Exportar para PDF (formato similar ao Excel original)

#### Atividades (`/atividades`)
- Lista de atividades registradas pelos operadores
- Filtros: por operador, equipamento, data, local
- Detalhe: fotos, horários, interferências
- Timeline visual da jornada do operador

#### Alertas de Segurança (`/alertas`)
- Criar e enviar alertas (título, mensagem, severidade, operador-alvo)
- Ver lista com status (lido/não lido) e respostas
- Reenviar notificação
- Alertas de comportamento inseguro
- Alertas de proibições

#### Inspeção Comportamental (`/inspecoes`)
- Formulário completo para o SSMA preencher
- Seção 1: Identificação (data, hora, unidade, área, equipamento, operador)
- Seção 2: Tipo de observação (rotina, atividade crítica, pós-incidente, etc.)
- Seção 3: Checklist comportamental (6 categorias, ~23 itens, cada um Sim/Não/NA)
- Seção 4: Desvios identificados (descrição, classificação, ação imediata)
- Seção 5: Ação corretiva/preventiva (responsável, prazo, status)
- Seção 6: Feedback ao colaborador
- Seção 7: Classificação final (Seguro / Em atenção / Crítico)
- Anexar foto/vídeo da câmera
- Lista de inspeções com filtros e status

#### Indicadores (`/indicadores`)
- Quantidade de atividades inspecionadas
- Quantidade e % de checklists realizados
- Quantidade e % de inspeções comportamentais
- Desvios por tipologia (gráfico)
- % de desvios críticos
- Índice de produtividade por equipamento
- Tempo médio de operação
- Nº de intervenções realizadas
- Score do operador (ranking)
- Filtros por período, operador, equipamento, área

#### Configurações (`/configuracoes`)
- Gerenciar usuários do sistema (admin, gestor, SSMA)
- Configurações de notificação
- Configurações gerais

---

## FASE 3 — Evolução do App Mobile (Expo) ✅ CONCLUÍDA (2026-04-26)

> **Status:** App mobile refatorado para foco exclusivo no operador. Grupo `(app)` removido, novas telas implementadas (Home, Pre-Operacao, Checklist dinamico C/NC/NA, Atividades), perfil com indicadores, compressão de fotos, validação robusta com Zod.

### 3.1 Remover funcionalidades de gestão do app

- [x] Remover grupo `(app)` inteiro (dashboard admin, gestão de operadores, criação de alertas, criação de checklists pelo gestor)
- [x] App fica 100% focado no operador
- [x] Tela de redirecionamento para não-operadores ("Use o site web")
- [x] Root layout atualizado para rotear apenas operadores

### 3.2 Novo fluxo do operador

#### Tela Inicial / Home (`(operator)/index.tsx`)
- [x] Saudação com nome do operador
- [x] Cards: Checklists Hoje, Atividades Hoje, Alertas
- [x] Status: pré-operação do dia (feita ou pendente) com card destacado
- [x] Ações rápidas: Novo Checklist, Registrar Atividade

#### Pré-Operação (`(operator)/pre-operacao.tsx`)
- [x] Formulário com as 10 perguntas do Smart Vision (Sim/Não cada)
- [x] Verifica se já foi preenchida hoje (mostra respostas se sim)
- [x] Itens críticos destacados visualmente (apto_operar, manutencao_valida)
- [x] Se algum item crítico for "Não" → alerta ao gestor automaticamente
- [x] Tela acessível via Home (tab oculta no bottom bar)

#### Checklist Pré-Uso (`(operator)/checklist.tsx`)
- [x] Passo 1: Selecionar tipo de equipamento (busca com filtro)
- [x] Passo 2: Preencher cabeçalho (Marca, Modelo, TAG, Turno, Capacidade)
- [x] Passo 3: Itens carregados dinamicamente do template
  - [x] Cada item: botões C / NC / NA
  - [x] Itens agrupados por seção (quando houver)
  - [x] Itens impeditivos destacados visualmente
  - [x] Possibilidade de tirar foto por item
- [x] Passo 4: Resultado automático
  - [x] Se TODOS os itens impeditivos = C ou NA → "EQUIPAMENTO LIBERADO AO TRABALHO"
  - [x] Se QUALQUER item impeditivo = NC → "NÃO LIBERADO. SOLICITAR MANUTENÇÃO"
  - [x] Operador não pode liberar equipamento com item impeditivo NC
- [x] Passo 5: Assinatura (nome + matrícula)
- [x] Indicador de progresso por passos (1-4)
- [x] Salva em checklists + checklist_responses
- [x] Vincula pre_operation_id do dia automaticamente

#### Registro de Atividade (`(operator)/atividade.tsx`)
- [x] Botão "Nova Atividade" (pode registrar várias no dia)
- [x] Campos:
  - [x] Foto do equipamento inspecionado
  - [x] Data (automático)
  - [x] Horário de início (automático ao criar)
  - [x] Local da atividade
  - [x] Descrição da atividade
  - [x] Foto de início da atividade
- [x] Ao finalizar:
  - [x] Horário de término (automático)
  - [x] Foto de término
  - [x] Houve interferência? (Sim/Não + descrição)
  - [x] Translado: horário início e término (botões de marcação)
  - [x] Observações (anomalias que impactaram)
- [x] Lista de atividades do dia com status (em andamento / finalizada)

#### Alertas (`(operator)/alerts.tsx`) — mantido
- [x] Receber alertas em tempo real (Realtime + push)
- [x] Responder alertas
- [x] Histórico de alertas

#### Perfil (`(operator)/profile.tsx`) — melhorado
- [x] Dados do operador
- [x] Score/indicadores pessoais do mês (quando disponível)
- [x] Estatísticas: checklists, inspeções, desvios, intervenções
- [x] Logout

### 3.3 Melhorias técnicas no app

- [ ] Suporte offline (cache de templates, sincronização quando online) — requer pacote adicional (AsyncStorage)
- [x] Compressão de fotos antes do upload (qualidade 0.5 via ImagePicker)
- [x] Utilitário centralizado de fotos (`src/lib/imageUtils.ts`)
- [x] Validação mais robusta nos formulários (schemas Zod para pre-operação e atividades)
- [x] Tabs reorganizadas: Inicio, Checklist, Atividades, Alertas, Perfil

---

## FASE 4 — Integrações e Automações ✅ CONCLUÍDA (2026-04-26)

> **Status:** Triggers de banco criados para notificações automáticas, 3 Edge Functions implementadas, Realtime habilitado em checklists/activities/behavioral_inspections, dashboard web atualizado com dados reais e subscriptions em tempo real.

### 4.1 Notificações (Triggers automáticos)

- [x] Push notifications via Expo (já existia, mantido)
- [x] Trigger `notify_blocking_nc()` — alerta automático ao gestor quando item impeditivo = NC em checklist_responses
- [x] Trigger `notify_behavioral_inspection()` — alerta ao operador quando inspeção comportamental é registrada
- [x] Trigger `notify_critical_deviation()` — alerta broadcast para SSMA/gestores quando desvio high/critical é criado
- [x] Trigger `notify_critical_pre_operation()` — alerta ao gestor quando operador marca "Não" em item crítico da pré-operação (apto_operar, manutencao_valida)
- [x] Trigger `dispatch_push_notification()` — intercepta INSERTs em safety_alerts e chama a Edge Function via pg_net para disparar push notifications automaticamente

### 4.2 Supabase Edge Functions

- [x] `calculate-operator-score` — calcula score mensal do operador (checklists 40%, desvios 30%, produtividade 20%, inspeções 10%). Calcula dias úteis dinamicamente. Suporta cálculo individual ou batch para todos operadores ativos. Upsert em operator_scores.
- [x] `generate-report` — gera relatório JSON estruturado com summary para 4 tipos: checklist, inspection, activity, operator_summary. Filtros por operador, data_inicio, data_fim.
- [x] `notify-blocking-item` — dispara push notification via Expo API para 4 cenários: blocking_nc (gestores), behavioral_inspection (operador), critical_deviation (SSMA), custom (baseado em safety_alert). Chamada automaticamente pelo trigger `dispatch_push_notification()`.

### 4.3 Realtime

- [x] Alertas: operador recebe em tempo real (já existia via safety_alerts)
- [x] Checklists: habilitado Realtime — gestor vê em tempo real quando operador preenche
- [x] Atividades: habilitado Realtime — acompanhamento em tempo real da jornada
- [x] Inspeções comportamentais: habilitado Realtime
- [x] Dashboard web atualizado com dados reais do Supabase + subscriptions Realtime (checklists, activities, safety_alerts)

### 4.4 Arquivos criados/modificados

- `supabase/migrations/005_phase4_triggers_and_realtime.sql` — Migration com 5 triggers + 1 trigger de push + Realtime em 3 tabelas + pg_net
- `supabase/functions/calculate-operator-score/index.ts` — Edge Function de score
- `supabase/functions/generate-report/index.ts` — Edge Function de relatórios
- `supabase/functions/notify-blocking-item/index.ts` — Edge Function de push notifications
- `web/src/app/(dashboard)/dashboard/page.tsx` — Dashboard reescrito como client component com dados reais e Realtime

### 4.5 Configuração necessária para push via pg_net

Para que o trigger `dispatch_push_notification()` consiga chamar a Edge Function, é necessário configurar no Supabase:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://fyijdolfwvdtofzowdob.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

Sem essa configuração, os triggers continuam criando alertas normalmente (visíveis via Realtime), mas push notifications não são enviadas. O trigger tem fallback seguro (EXCEPTION WHEN OTHERS).

---

## Ordem de Execução

| Etapa | Descrição | Depende de |
|-------|-----------|------------|
| 1 | Criar novas tabelas no Supabase + seed dos 29 equipamentos | — |
| 2 | ✅ Criar projeto Next.js com auth e layout base | 1 |
| 3 | Página de templates de checklist no site (CRUD dos 29 tipos) | 1, 2 |
| 4 | Refatorar app: checklist dinâmico C/NC/NA com bloqueio impeditivo | 1 |
| 5 | Página de operadores no site + migrar gestão do app | 2 |
| 6 | Página de alertas no site + migrar criação do app | 2 |
| 7 | Remover grupo (app) do mobile, app fica só operador | 5, 6 |
| 8 | Adicionar pré-operação no app | 1 |
| 9 | Adicionar registro de atividades no app | 1 |
| 10 | Dashboard de indicadores no site | 1, 2 |
| 11 | Módulo de inspeção comportamental no site | 1, 2 |
| 12 | Score do operador (Edge Function + exibição no site e app) | 10, 11 |
| 13 | Exportação PDF de checklists e relatórios | 3, 4 |

---

## Estrutura de Pastas Final

```
app/                          ← Projeto raiz
├── web/                      ← Site Next.js (NOVO)
│   ├── src/
│   │   ├── app/              ← App Router pages
│   │   │   ├── (auth)/       ← Login gestores
│   │   │   ├── dashboard/
│   │   │   ├── operadores/
│   │   │   ├── templates/
│   │   │   ├── checklists/
│   │   │   ├── atividades/
│   │   │   ├── alertas/
│   │   │   ├── inspecoes/
│   │   │   ├── indicadores/
│   │   │   └── configuracoes/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   └── types/
│   ├── package.json
│   └── next.config.js
│
├── app/                      ← Expo Router (mobile - SÓ OPERADOR)
│   ├── (auth)/               ← Login operador
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (operator)/           ← Telas do operador
│   │   ├── _layout.tsx
│   │   ├── index.tsx         ← Home do operador
│   │   ├── pre-operacao.tsx  ← NOVO
│   │   ├── checklist.tsx     ← REFATORADO (dinâmico)
│   │   ├── atividade.tsx     ← NOVO
│   │   ├── alerts.tsx        ← Manter
│   │   └── profile.tsx       ← Manter
│   └── _layout.tsx
│
├── src/                      ← Código compartilhado mobile
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── schemas/
│   ├── theme/
│   └── types/
│
├── supabase/                 ← Migrations e seeds (NOVO)
│   ├── migrations/
│   │   ├── 001_equipment_types.sql
│   │   ├── 002_checklist_templates.sql
│   │   ├── 003_pre_operation.sql
│   │   ├── 004_evolve_checklists.sql
│   │   ├── 005_checklist_responses.sql
│   │   ├── 006_activities.sql
│   │   ├── 007_behavioral_inspections.sql
│   │   ├── 008_operator_scores.sql
│   │   └── 009_rls_policies.sql
│   └── seed/
│       ├── equipment_types.sql
│       └── checklist_template_items.sql
│
├── acao/                     ← Documentos de referência
├── app.json
├── package.json
└── mudança.md                ← Este arquivo
```

---

## Tecnologias

| Componente | Tecnologia |
|-----------|------------|
| App Mobile | Expo / React Native (existente) |
| Site Web | Next.js 14+ (App Router) |
| UI Web | Tailwind CSS + shadcn/ui |
| Backend | Supabase (Auth, PostgreSQL, Storage, Realtime, Edge Functions) |
| Notificações | Expo Notifications (push) + Supabase Realtime (local) |
| Relatórios | Edge Functions + geração de PDF |
