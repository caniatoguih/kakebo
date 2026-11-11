import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const assetsDirectory = join(outputDirectory, 'assets');
const compressedSize = (file) => gzipSync(readFileSync(file)).length;
const files = readdirSync(assetsDirectory).map((name) => ({
  name,
  bytes: compressedSize(join(assetsDirectory, name)),
}));
const manifest = JSON.parse(readFileSync(join(outputDirectory, '.vite/manifest.json'), 'utf8'));

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
const initialBytes = initialFiles.reduce((total, file) => total + compressedSize(join(outputDirectory, file)), 0);
const totalAssetBytes = files.reduce((total, file) => total + file.bytes, 0);

const budgets = [
  { label: 'entrada principal gzip', pattern: /^index-.*\.js$/, maxBytes: 140_000 },
  { label: 'CSS principal gzip', pattern: /^index-.*\.css$/, maxBytes: 18_000 },
  { label: 'shell do Dashboard gzip', pattern: /^Dashboard-.*\.js$/, maxBytes: 13_000 },
  { label: 'Fluxo de Caixa gzip', pattern: /^Transacoes-.*\.js$/, maxBytes: 12_000 },
  { label: 'gráfico de orçamento gzip', pattern: /^BudgetComparisonChart-.*\.js$/, maxBytes: 2_000 },
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
  { label: 'JavaScript inicial com dependências gzip', bytes: initialBytes, maxBytes: 140_000 },
  { label: 'todos os assets gzip', bytes: totalAssetBytes, maxBytes: 400_000 },
]) {
  const withinBudget = aggregate.bytes <= aggregate.maxBytes;
  console.log(`${withinBudget ? 'OK' : 'ERRO'} ${aggregate.label}: ${(aggregate.bytes / 1000).toFixed(2)} kB / ${(aggregate.maxBytes / 1000).toFixed(0)} kB`);
  if (!withinBudget) failed = true;
}

if (failed) process.exit(1);
