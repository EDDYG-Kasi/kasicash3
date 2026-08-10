import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ignoredDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'outputs',
]);
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.txt',
  '.yml',
  '.yaml',
]);
const textNames = new Set(['.env.example', '.gitattributes', '.gitignore']);
const fix = process.argv.includes('--fix');
const root = process.cwd();
const failures = [];

for (const path of await walk(root)) {
  const relativePath = relative(root, path).replaceAll('\\', '/');
  const original = await readFile(path, 'utf8');
  const normalized = original
    .replaceAll('\r\n', '\n')
    .replace(/[ \t]+$/gm, '');
  if (original === normalized) continue;
  if (fix) {
    await writeFile(path, normalized, 'utf8');
  } else {
    failures.push(relativePath);
  }
}

if (failures.length > 0) {
  console.error(`text hygiene failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
}

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await walk(path)));
    } else if (
      entry.isFile() &&
      (textExtensions.has(extname(entry.name)) || textNames.has(entry.name))
    ) {
      paths.push(path);
    }
  }
  return paths;
}
