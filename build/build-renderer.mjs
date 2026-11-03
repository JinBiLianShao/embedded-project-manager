import { build, context } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'renderer');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(root, 'src', 'renderer', 'main.js')],
  bundle: true,
  outfile: path.join(outDir, 'bundle.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

async function copyStatic() {
  // 图标等静态资源在旧版里是仓库根目录的散文件，这里统一收进 build 产物
  const icons = path.join(root, 'icons');
  if (!existsSync(icons)) await mkdir(icons, { recursive: true });
}

async function run() {
  await copyStatic();
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    console.log('[build] watching renderer…');
    return;
  }
  await build(options);
  console.log('[build] renderer bundle written to src/renderer/bundle.js');
}

run().catch((error) => {
  console.error('[build] failed:', error);
  process.exit(1);
});
