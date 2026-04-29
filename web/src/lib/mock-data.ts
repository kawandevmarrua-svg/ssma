// ══════════════════════════════════════════════════════════════
// Mock data compartilhado — operadores, máquinas, frentes e tipos
// reais do sistema. Mude USE_MOCK para false ao conectar ao banco.
// ══════════════════════════════════════════════════════════════

export const USE_MOCK = true;

// ── Operadores reais (perfis do Supabase) ──

export const MOCK_OPERATORS = [
  { id: 'op-carlos', name: 'Carlos Eduardo Silva' },
  { id: 'op-joao', name: 'João Victor Mendes' },
  { id: 'op-ricardo', name: 'Ricardo de Souza' },
  { id: 'op-pedro', name: 'Pedro Henrique Lima' },
  { id: 'op-andre', name: 'André Luiz Costa' },
  { id: 'op-marcos', name: 'Marcos Paulo Oliveira' },
  { id: 'op-lucas', name: 'Lucas Ferreira Santos' },
  { id: 'op-rafael', name: 'Rafael Almeida Rocha' },
];

// ── Máquinas (baseadas nos equipment_types do seed) ──

export const MOCK_MACHINES = [
  { id: 'maq-01', name: 'Escavadeira Hidraulica', tag: 'ESC-001', active: true },
  { id: 'maq-02', name: 'Caminhao Basculante', tag: 'CB-012', active: true },
  { id: 'maq-03', name: 'Pa Carregadeira', tag: 'PC-003', active: true },
  { id: 'maq-04', name: 'Motoniveladora', tag: 'MN-002', active: true },
  { id: 'maq-05', name: 'Retroescavadeira', tag: 'RE-005', active: true },
  { id: 'maq-06', name: 'Rolo Compactador', tag: 'RC-001', active: true },
  { id: 'maq-07', name: 'Caminhao Pipa', tag: 'CP-004', active: true },
  { id: 'maq-08', name: 'Trator de Esteira', tag: 'TE-002', active: true },
  { id: 'maq-09', name: 'Mini Carregadeira', tag: 'MC-001', active: false },
  { id: 'maq-10', name: 'Perfuratriz', tag: 'PF-003', active: true },
];

// ── Frentes de serviço / localidades ──

export const MOCK_FRENTES = [
  'Frente Norte',
  'Frente Sul',
  'Frente Leste',
  'Patio Central',
  'Acesso Principal',
  'Area de Bota-Fora',
  'Barragem B3',
  'Pilha de Esteril',
];

// ── Tipos de atividade (do seed activity_types) ──

export const MOCK_ACTIVITY_TYPES = [
  { code: 'S01', description: 'Construcao de praca' },
  { code: 'S02', description: 'Construcao de talude' },
  { code: 'S03', description: 'Limpeza do sump' },
  { code: 'S04', description: 'Abertura de canaletas' },
  { code: 'S05', description: 'Abastecimento de equipamento' },
  { code: 'S07', description: 'Confeccao de leira' },
  { code: 'S09', description: 'Revitalizacao de acesso' },
  { code: 'P04', description: 'Manutencao (Incluindo Lubrificacao)' },
  { code: 'P06', description: 'Abastecimento' },
  { code: 'P11', description: 'Locomocao propria (Maquina x frente)' },
  { code: 'P12', description: 'Deslocamento (operador x frente)' },
];

// ── PRNG determinístico (resultados consistentes entre renders) ──

export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}
