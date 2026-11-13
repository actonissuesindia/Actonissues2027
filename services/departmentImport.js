const ExcelJS = require('exceljs');

// Parses a "PRI Localbody Email IDs" style report exported from
// lgdirectory.gov.in (the Ministry of Panchayati Raj's directory) into
// plain { name, email } rows for controllers/departmentContactController.js
// to save. Deliberately tolerant of format quirks rather than assuming one
// exact layout:
//  - .xlsx opens directly via ExcelJS.
//  - .xls from older/ASP.NET-style government report pages is very often
//    actually an HTML table saved with an .xls extension, not a real binary
//    workbook — ExcelJS will throw on that, so it's retried as HTML.
//  - .csv is parsed as plain delimited text.
// The report always has a title/merged-cell row above the real header
// ("PRI Localbody E-mail ID's of Grama Panchayat of X..."), so the header
// row is found by searching for a row containing both a "name" and an
// "email" column, rather than assuming it's row 1.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw) {
  if (!raw) return '';
  const s = String(raw).trim()
    .replace(/\[at\]/gi, '@')
    .replace(/\[dot\]/gi, '.')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s*\(dot\)\s*/gi, '.');
  return EMAIL_RE.test(s) ? s.toLowerCase() : '';
}

// Given a 2D array of row cells (already stringified), find the header row
// and return { rows: [{name, email}], headerFound: bool }.
function extractFromGrid(grid) {
  let headerIdx = -1;
  let nameCol = -1;
  let typeCol = -1;
  let emailCol = -1;

  for (let i = 0; i < grid.length; i++) {
    const row = grid[i].map(c => (c || '').toString().trim().toLowerCase());
    const email = row.findIndex(c => c.includes('email'));
    const name = row.findIndex(c => c.includes('local body name') || (c.includes('name') && !c.includes('local language')));
    if (email !== -1 && name !== -1) {
      headerIdx = i;
      emailCol = email;
      nameCol = name;
      typeCol = row.findIndex(c => c.includes('local body type') || c === 'type');
      break;
    }
  }
  if (headerIdx === -1) return { rows: [], headerFound: false };

  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    const email = normalizeEmail(row[emailCol]);
    const name = (row[nameCol] || '').toString().trim();
    if (!email || !name) continue;
    const type = typeCol !== -1 ? (row[typeCol] || '').toString().trim() : '';
    rows.push({ name: type ? `${name} (${type})` : name, email });
  }
  return { rows, headerFound: true };
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], headerFound: false };
  const grid = [];
  sheet.eachRow((row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.text || ''));
    grid.push(cells);
  });
  return extractFromGrid(grid);
}

// Strips tags from a table cell's inner HTML and decodes the handful of
// entities government report pages actually use — not a general-purpose
// HTML-to-text converter, just enough for plain table cell content.
function cellText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTable(text) {
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { rows: [], headerFound: false };
  const rowMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const grid = rowMatches.map(rowHtml => {
    const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    return cellMatches.map(c => cellText(c));
  });
  return extractFromGrid(grid);
}

// lgdirectory.gov.in's report/export screens (confirmed against a real
// download, not guessed) produce old-style "Excel XML" (SpreadsheetML) —
// distinct from both real .xlsx (zip/OOXML) and HTML-as-.xls. Cells omit
// ss:Index when they're one past the previous cell, and jump to it
// otherwise (merged/blank cells aren't repeated) — a plain "read cells in
// document order" pass misaligns columns without tracking that.
function isSpreadsheetML(text) {
  return /urn:schemas-microsoft-com:office:spreadsheet/i.test(text.slice(0, 2000));
}

function parseSpreadsheetML(text) {
  const rowBlocks = text.match(/<Row[^>]*>[\s\S]*?<\/Row>/g) || [];
  const grid = rowBlocks.map(rowXml => {
    const sparse = [];
    let idx = 0;
    const cellBlocks = rowXml.match(/<Cell[^>]*>[\s\S]*?<\/Cell>|<Cell[^>]*\/>/g) || [];
    for (const cellXml of cellBlocks) {
      const idxAttr = cellXml.match(/ss:Index="(\d+)"/);
      idx = idxAttr ? parseInt(idxAttr[1], 10) : idx + 1;
      const dataMatch = cellXml.match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
      sparse[idx] = dataMatch ? cellText(dataMatch[1]) : '';
    }
    // Cells at skipped indexes (merged/blank in the source) are real holes
    // in `sparse` — Array.from densifies them to '' so every later .find/
    // .findIndex over this row sees plain strings, never a hole's `undefined`.
    return Array.from({ length: sparse.length }, (_, i) => sparse[i] || '');
  });
  return extractFromGrid(grid);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const grid = lines.map(line => {
    // Minimal CSV split: handles simple quoted fields, which is all a
    // government report export is likely to contain (plain names/emails,
    // no embedded commas-in-quotes edge cases beyond that).
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  });
  return extractFromGrid(grid);
}

// Returns { rows: [{name, email}], headerFound }. Throws only on a
// genuinely unreadable file (e.g. neither a valid workbook nor HTML/CSV).
async function parseDepartmentReport(buffer, originalname) {
  const ext = (originalname.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return parseCsv(buffer.toString('utf8'));

  try {
    return await parseXlsx(buffer);
  } catch (xlsxErr) {
    const text = buffer.toString('utf8');
    if (isSpreadsheetML(text)) return parseSpreadsheetML(text);
    if (/<table/i.test(text)) return parseHtmlTable(text);
    if (/^["\w]/.test(text.trim()) && text.includes(',')) return parseCsv(text);
    throw xlsxErr;
  }
}

module.exports = { parseDepartmentReport, normalizeEmail };
