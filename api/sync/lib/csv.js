function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\n') {
      row.push(field);
      field = '';
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    if (c === '\r') continue;
    field += c;
  }

  row.push(field);
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h || '').trim());
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const obj = {};
    for (let j = 0; j < header.length; j += 1) {
      obj[header[j]] = r[j] ?? '';
    }
    out.push(obj);
  }
  return out;
}

module.exports = {
  parseCsv,
  rowsToObjects,
};
