# Product

## Register

product

## Users

Gestores, encarregados e admins de segurança operacional da Marrua. Usam o dashboard web (Next.js) sentados num escritório ou supervisionando campo, em desktop e às vezes tablet. Estão numa tarefa: acompanhar operadores, checklists, atividades, inspeções e localização em tempo real. Operadores em campo usam o app mobile separado; este produto é a visão de comando.

## Product Purpose

Painel de gestão de segurança operacional. Centraliza checklists pré-operação, atividades, inspeções comportamentais, manutenção e rastreamento GPS dos operadores. Sucesso = um gestor abre uma tela e em segundos entende o estado do campo (quem está ativo, onde, com que máquina, com que conformidade) sem caçar dado.

## Brand Personality

Operacional, confiável, direto. Cor primária laranja (segurança/EPI). Tom de ferramenta séria de trabalho, não de marketing. Densidade de informação é uma virtude aqui: o gestor quer ver muito de uma vez, organizado.

## Anti-references

- Não é landing page nem dashboard "bonito de print". Sem heros, sem números gigantes decorativos, sem motion de entrada coreografado.
- Sem SaaS-cream / gradientes decorativos / glassmorphism.
- Side-stripe borders, eyebrow uppercase em toda seção, card grids idênticos infinitos.

## Design Principles

1. **A ferramenta some na tarefa.** Familiaridade > surpresa. Mesmo vocabulário de componente tela a tela.
2. **Densidade com hierarquia.** Mostrar muito, mas com peso visual claro: estado primário forte, secundário discreto.
3. **Cor carrega significado, não decora.** Status (online/atividade/checklist/idle/offline) e eventos têm cores fixas e consistentes em todo lugar.
4. **Uma fonte de verdade por conceito.** Metadado de status/evento definido em um único lugar, nunca re-derivado inline.

## Accessibility & Inclusion

WCAG AA de contraste para texto. Foco visível em todo elemento interativo (inclui `<button>` cru). Respeitar `prefers-reduced-motion`. Light-only por ora (tokens dark existem mas não há toggle ativo).
