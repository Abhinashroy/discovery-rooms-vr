import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeExports, formatAnalysis } from '../src/analysis.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = process.argv.slice(2).filter((arg) => arg !== '--json');
const targets = paths.length ? paths : [path.join(projectRoot, 'data', 'real')];
const files = [];
for (const target of targets) {
  const stat = await import('node:fs/promises').then(({ stat }) => stat(target));
  if (stat.isDirectory()) {
    for (const entry of await readdir(target))
      if (entry.toLowerCase().endsWith('.json')) files.push(path.join(target, entry));
  } else if (target.toLowerCase().endsWith('.json')) files.push(target);
  else throw new Error(`Expected JSON export: ${target}`);
}
const exports = [];
for (const file of files) {
  try {
    exports.push(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}
const report = analyzeExports(exports);
process.stdout.write(
  process.argv.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : formatAnalysis(report),
);
