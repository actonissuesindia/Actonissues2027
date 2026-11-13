// Catches a helper that a file uses but never imports.
//
// Written after exactly that bug reached production: TopNav.jsx and Footer.jsx
// both called withoutRetiredLinks() with no import for it. A bundler treats an
// unknown identifier as a global reference rather than an error, so the build
// passed cleanly and the browser threw ReferenceError on first render — a
// blank page for every visitor. The backend test suite never renders a React
// component, so nothing caught it.
//
// This is a blunt check, not a type system: it looks for a call to something
// one of our own modules exports, in a file that does not import it. That is
// the shape of the bug that got through.
//
// Usage: node scripts/checkImports.js   (exit code 1 if anything is wrong)
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'src');

function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

// Strips comments and string literals, so a name mentioned in prose or in a
// message doesn't read as a call.
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const files = sourceFiles(SOURCE_DIR);

// What our own modules export.
const exportedBy = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf-8');
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) exportedBy.set(m[1], file);
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) exportedBy.set(m[1], file);
}

const problems = [];
for (const file of files) {
  const code = codeOnly(fs.readFileSync(file, 'utf-8'));
  // Everything this file brings in, however it is written.
  const importedNames = new Set();
  for (const m of code.matchAll(/import\s+([\s\S]*?)\s+from\s+/g)) {
    for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) importedNames.add(n[0]);
  }
  // ...and everything it declares itself, so a local of the same name is fine.
  for (const m of code.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) importedNames.add(m[1]);

  for (const [name, from] of exportedBy) {
    if (path.resolve(from) === path.resolve(file)) continue;
    if (importedNames.has(name)) continue;
    // A call to it, not preceded by a dot (so obj.name() doesn't count).
    const called = new RegExp(String.raw`(?<![\w$.])${name}\s*\(`).test(code);
    if (called) problems.push({ file: path.relative(process.cwd(), file), name, from: path.relative(process.cwd(), from) });
  }
}

if (problems.length === 0) {
  console.log(`Checked ${files.length} files — every helper that is called is imported.`);
} else {
  for (const p of problems) console.error(`MISSING IMPORT  ${p.file}  calls  ${p.name}()  — exported by ${p.from}`);
  console.error(`\n${problems.length} problem(s). These build fine and throw in the browser.`);
  process.exitCode = 1;
}
