export const CARGOS = [
  'Técnico de segurança',
  'Engenheiro de segurança',
  'Coordenador de segurança',
  'Analista de SSMA',
  'Supervisor de operações',
] as const;

export type Cargo = (typeof CARGOS)[number];
