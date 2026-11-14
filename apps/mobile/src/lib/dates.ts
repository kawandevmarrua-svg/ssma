/**
 * Retorna a data de hoje (AAAA-MM-DD) no fuso LOCAL do dispositivo.
 *
 * NUNCA use `new Date().toISOString().split('T')[0]` para representar "hoje" do
 * operador: isoString eh UTC, e em qualquer fuso negativo (ex.: Brasil UTC-3)
 * apos as 21h o resultado eh ja o dia seguinte. Isso fazia checklist salvo
 * `29/04` virar `30/04` no banco e quebrar o pareamento com a atividade.
 */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Subtrai N dias de hoje (local) e retorna AAAA-MM-DD.
 */
export function localDateMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
