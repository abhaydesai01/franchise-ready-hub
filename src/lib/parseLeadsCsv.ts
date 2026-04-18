/**
 * RFC4180-style CSV: comma-separated, double-quote escaping.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.some((x) => x.trim().length > 0)) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  row.push(field);
  if (row.some((x) => x.trim().length > 0)) rows.push(row);
  return rows;
}

const NORM = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '_');

/**
 * First row = headers. Expect at least a `name` column (or `full_name`).
 * Returns one object per data row.
 */
export function parseLeadsCsvToRows(text: string): unknown[] {
  const table = parseCSV(text.replace(/^\uFEFF/, ''));
  if (table.length < 2) return [];
  const header = table[0]!.map((h) => NORM(h));
  const col = (candidates: string[]) => {
    for (const c of candidates) {
      const j = header.indexOf(NORM(c));
      if (j >= 0) return j;
    }
    return -1;
  };
  const nameI = col(['name', 'full_name', 'contact_name', 'lead_name']);
  if (nameI < 0) return [];
  const phoneI = col(['phone', 'mobile', 'phone_number', 'cell']);
  const emailI = col(['email', 'e-mail', 'mail']);
  const companyI = col(['company', 'business', 'organization']);
  const sourceI = col(['source', 'lead_source', 'channel']);
  const notesI = col(['notes', 'note', 'comments', 'remarks']);

  const out: unknown[] = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r]!;
    const name = (row[nameI] ?? '').trim();
    if (!name) continue;
    const o: Record<string, string> = { name };
    if (phoneI >= 0 && row[phoneI]?.trim()) o.phone = row[phoneI]!.trim();
    if (emailI >= 0 && row[emailI]?.trim()) o.email = row[emailI]!.trim();
    if (companyI >= 0 && row[companyI]?.trim()) o.company = row[companyI]!.trim();
    if (sourceI >= 0 && row[sourceI]?.trim()) o.source = row[sourceI]!.trim();
    if (notesI >= 0 && row[notesI]?.trim()) o.notes = row[notesI]!.trim();
    out.push(o);
  }
  return out;
}
