import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const files = readdirSync(assetsDirectory).map((name) => ({ name, bytes: statSync(join(assetsDirectory.pathname, name)).size }));
const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));

function collectEntryFiles(key, collected = new Set()) {
  const item = manifest[key];
  if (!item || collected.has(item.file)) return collected;
  collected.add(item.file);
  for (const imported of item.imports ?? []) collectEntryFiles(imported, collected);
  return collected;
}

const entry = Object.entries(manifest).find(([, item]) => item.isEntry);
if (!entry) throw new Error('Entrada principal ausente do manifesto do Vite.');
const initialFiles = [...collectEntryFiles(entry[0])];
const initialBytes = initialFiles.reduce((total, file) => total + statSync(new URL(`../dist/${file}`, import.meta.url)).size, 0);
const totalAssetBytes = files.reduce((total, file) => total + file.bytes, 0);

const budgets = [
  { label: 'entrada principal', pattern: /^index-.*\.js$/, maxBytes: 375_000 },
  { label: 'CSS principal', pattern: /^index-.*\.css$/, maxBytes: 70_000 },
  { label: 'shell do Dashboard', pattern: /^Dashboard-.*\.js$/, maxBytes: 30_000 },
  { label: 'Fluxo de Caixa', pattern: /^Transacoes-.*\.js$/, maxBytes: 50_000 },
  { label: 'gráfico de orçamento', pattern: /^BudgetComparisonChart-.*\.js$/, maxBytes: 5_000 },
];

let failed = false;
for (const budget of budgets) {
  const matches = files.filter((file) => budget.pattern.test(file.name));
  if (matches.length !== 1) {
    console.error(`Não foi possível identificar ${budget.label} no build.`);
    failed = true;
    continue;
  }
  const [file] = matches;
  const withinBudget = file.bytes <= budget.maxBytes;
  console.log(`${withinBudget ? 'OK' : 'ERRO'} ${budget.label}: ${(file.bytes / 1000).toFixed(2)} kB / ${(budget.maxBytes / 1000).toFixed(0)} kB`);
  if (!withinBudget) failed = true;
}

for (const aggregate of [
  { label: 'JavaScript inicial com dependências', bytes: initialBytes, maxBytes: 370_000 },
  { label: 'todos os assets', bytes: totalAssetBytes, maxBytes: 900_000 },
]) {
  const withinBudget = aggregate.bytes <= aggregate.maxBytes;
  console.log(`${withinBudget ? 'OK' : 'ERRO'} ${aggregate.label}: ${(aggregate.bytes / 1000).toFixed(2)} kB / ${(aggregate.maxBytes / 1000).toFixed(0)} kB`);
  if (!withinBudget) failed = true;
}

if (failed) process.exit(1);
