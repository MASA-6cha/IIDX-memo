import {readdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

export function createWorker(template, build, assets) {
  return template.replace('__IIDX_BUILD__', build).replace('/* __IIDX_ASSETS__ */ []', JSON.stringify(assets));
}

async function walk(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(directory, e.name)) : resolve(directory, e.name)))).flat();
}

async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const client = resolve(root, 'pages-dist');
  const template = await readFile(resolve(root, 'scripts/offline-worker.js'), 'utf8');
  const files = (await walk(resolve(client, 'assets'))).filter(path => /\.(js|css|woff2?|ttf|otf|png|svg|webp)$/.test(path));
  files.push(...['favicon.svg', 'manifest.webmanifest', 'icons/iidx-memo-192-v2.png', 'icons/iidx-memo-512-v2.png', 'icons/iidx-memo-apple-v2.png', 'icons/iidx-memo-favicon-v2.png'].map(path => resolve(client, path)));
  const assets = files.map(path => '/IIDX-memo/' + relative(client, path)).sort();
  const hash = createHash('sha256').update(template);
  for (const asset of assets) hash.update(asset).update(await readFile(resolve(client, asset.slice('/IIDX-memo/'.length))));
  const build = hash.digest('hex').slice(0, 16);
  if (!assets.some(p => p.endsWith('.js')) || !assets.some(p => p.endsWith('.css'))) throw new Error('Offline app assets missing');
  await writeFile(resolve(client, 'sw.js'), createWorker(template, build, assets));
  const headersPath = resolve(client, '_headers');
  const headers = await readFile(headersPath, 'utf8').catch(() => '');
  await writeFile(headersPath, headers + '\n/sw.js\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Cache-Control: no-cache\n');
  console.log(`Offline app prepared: ${assets.length} assets.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
