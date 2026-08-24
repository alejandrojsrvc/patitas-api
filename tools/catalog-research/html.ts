const entities: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

export const decodeHtml = (value: string): string =>
  value
    .replace(
      /&(amp|quot|#39|apos|lt|gt|nbsp);/g,
      (match) => entities[match] ?? match,
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    );

export const stripTags = (value: string): string =>
  decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeText = (
  value: string | null | undefined,
): string | null => {
  const normalized = stripTags(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
};

export const extractAttribute = (
  html: string,
  tag: string,
  attribute: string,
): string[] => {
  const values: string[] = [];
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  for (const match of html.matchAll(tagPattern)) {
    const attributePattern = new RegExp(
      `\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
      'i',
    );
    const value = match[0].match(attributePattern)?.[1];
    if (value) values.push(decodeHtml(value.trim()));
  }
  return values;
};

export const extractMeta = (html: string, property: string): string | null => {
  const pattern = new RegExp(
    `<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${property}["'][^>]*>`,
    'i',
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return null;
  return tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
};

export const extractJsonLd = (html: string): unknown[] => {
  const values: unknown[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      values.push(JSON.parse(decodeHtml(match[1].trim())) as unknown);
    } catch {
      // A malformed JSON-LD block must not prevent DOM extraction.
    }
  }
  return values;
};

export const flattenJsonLd = (values: unknown[]): Record<string, unknown>[] => {
  const flattened: Record<string, unknown>[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    flattened.push(record);
    if (record['@graph']) visit(record['@graph']);
  };
  values.forEach(visit);
  return flattened;
};

export const extractTables = (html: string): string[][] => {
  const tables: string[][] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows: string[] = [];
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map((cell) => normalizeText(cell[1]))
        .filter((cell): cell is string => Boolean(cell));
      if (cells.length > 0) rows.push(cells.join(' | '));
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
};

export const extractSectionText = (
  html: string,
  heading: string,
): string | null => {
  const headingPattern = new RegExp(
    `<h[1-6]\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6]\\b|<footer\\b|$)`,
    'i',
  );
  return normalizeText(html.match(headingPattern)?.[1]);
};

export const htmlToText = (html: string): string => stripTags(html);

export const extractLinks = (html: string, baseUrl: string): string[] => {
  const links: string[] = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
  )) {
    try {
      links.push(new URL(match[1], baseUrl).toString());
    } catch {
      // Ignore malformed links published by the source page.
    }
  }
  return links.filter((url, index, values) => values.indexOf(url) === index);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
