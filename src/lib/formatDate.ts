/**
 * Format a YYYY-MM-DD date string as mm/dd/yyyy.
 * Used everywhere in IT Buddy for consistent date display.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}
