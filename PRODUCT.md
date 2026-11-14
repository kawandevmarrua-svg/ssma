# Product

## Register

product

> Exceção: a landing page (`apps/web/src/app/page.tsx`) é superfície de marca — recebe tratamento brand quando trabalhada.

## Users

- **Operadores de campo**: usam o app mobile (Expo) em canteiro de obra, sob sol, com luva, sinal instável. Tarefa: checklist pré-operação, inspeções, apontamento de atividade. Precisam de telas grandes, diretas, tolerantes a erro.
- **Encarregados**: supervisionam equipe em campo, acompanham checklists da equipe pelo app.
- **Gestores/admin (SSMA e operação)**: usam o dashboard web (Next.js) no escritório. Tarefa: monitorar conformidade, alertas, localização das equipes, manutenção.

## Product Purpose

Gestão de segurança operacional da Marrua Engenharia ("Segurança em 360"): operadores registram checklists e inspeções pelo app; gestores acompanham conformidade, alertas e equipes em tempo real no painel. Sucesso = registro em campo sem atrito e não conformidade chegando ao gestor na hora.

## Brand Personality

Confiável, industrial, direto. Firmeza e clareza de quem opera máquina pesada; zero enfeite. Tom de voz objetivo, português de campo, sem jargão de marketing.

## Anti-references

- SaaS genérico de template: gradientes roxos, glassmorphism decorativo, grids de cards idênticos, clichês de landing (hero-metric, eyebrows em toda seção).
- Qualquer coisa que pareça frágil ou "startupzinha" — o público confia em ferramenta que parece sólida.

## Design Principles

1. **Campo primeiro**: no mobile, legibilidade sob sol e alvos de toque grandes vencem estética.
2. **Sinal, não ruído**: cor comunica estado (conforme/alerta/pendente); decoração não compete com dado.
3. **Sólido e direto**: superfícies firmes, contraste alto, hierarquia por peso e escala — não por ornamento.
4. **Uma verdade por tela**: cada tela do dashboard responde uma pergunta do gestor sem caça ao dado.

## Accessibility & Inclusion

- Contraste WCAG AA mínimo (4.5:1 corpo) — crítico no mobile usado ao ar livre.
- Reduced motion respeitado em todas as animações.
- Não depender só de cor para estado (ícone/texto junto).
