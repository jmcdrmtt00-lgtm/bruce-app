/**
 * Format a task number for display based on its source.
 *   it            → plain integer  (e.g. 5)
 *   email         → T-prefixed     (e.g. T5)
 *   direct_ticket → D-prefixed     (e.g. D5)
 *
 * All sources share one integer sequence; the prefix is display-only.
 */
export function formatTaskNumber(
  taskNumber: number | null | undefined,
  source: string | null | undefined,
): string {
  if (taskNumber == null) return '';
  if (source === 'email') return `T${taskNumber}`;
  if (source === 'direct_ticket') return `D${taskNumber}`;
  return String(taskNumber);
}
