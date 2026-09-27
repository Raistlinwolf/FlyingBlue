// Windows only: Next.js 16's static export writes client-navigation segment files into
// nested folders (out/<route>/__next.!KGFwcCk/<route>/__PAGE__.txt) instead of dotted
// file names (__next.!KGFwcCk.<route>.__PAGE__.txt), which 404s when testing out/ locally.
// Linux builds (GitHub Actions) are correct, so this is only for local testing.
//   node scripts/fix-windows-export.mjs [out]
import { readdirSync, renameSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? 'out';
let moved = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('__next.')) {
      walk(path);
      continue;
    }
    const files = [];
    const collect = (d) =>
      readdirSync(d, { withFileTypes: true }).forEach((f) => (f.isDirectory() ? collect(join(d, f.name)) : files.push(join(d, f.name))));
    collect(path);
    for (const file of files) {
      renameSync(file, join(dir, `${entry.name}.${relative(path, file).split(sep).join('.')}`));
      moved++;
    }
    rmSync(path, { recursive: true });
  }
}
walk(root);
console.log(`renamed ${moved} segment files`);
