export const csv = (headers: string[], rows: Array<Array<unknown>>): string =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText)
    ? `"${safeText.replace(/"/g, '""')}"`
    : safeText;
};
