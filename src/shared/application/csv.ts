export const csv = (headers: string[], rows: Array<Array<unknown>>): string =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') +
  '\r\n';

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'string') text = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    text = value.toString();
  else if (typeof value === 'symbol') text = value.description ?? '';
  else text = JSON.stringify(value) ?? '';
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText)
    ? `"${safeText.replace(/"/g, '""')}"`
    : safeText;
};
