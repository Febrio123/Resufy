/**
 * Syntax check seluruh source — dijalankan via `npm run check`.
 * Menggunakan `node --check` per file (tanpa mengeksekusi, tanpa butuh env).
 */
const { execFileSync } = require('child_process');
const { globSync } = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = globSync('src/**/*.js', { cwd: root }).sort();

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${f}`);
    console.error(String(err.stderr || err.message).trim());
  }
}

if (failed > 0) {
  console.error(`\n${failed} file GAGAL syntax check (dari ${files.length})`);
  process.exit(1);
}
console.log(`OK — ${files.length} file lolos node --check`);
