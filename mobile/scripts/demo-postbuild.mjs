// Prepares the web export of the browser demo for GitHub Pages:
// - .nojekyll, so Pages serves the _expo folder (Jekyll skips folders starting with "_");
// - 404.html, so a reload on a deep link (/gate21/lesson/...) still opens the app;
// - phone-like meta tags: no zoom on input focus, full screen when added to the home screen.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const index = join(dir, 'index.html');
const meta = [
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />',
  '<meta name="theme-color" content="#14171C" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="Gate 21" />',
].join('\n    ');
const html = readFileSync(index, 'utf8')
  .replace(/<meta name="viewport"[^>]*>/, meta)
  .replace('<title>Gate 21</title>', '<title>Gate 21 · Demo</title>');
writeFileSync(index, html);
copyFileSync(index, join(dir, '404.html'));
writeFileSync(join(dir, '.nojekyll'), '');
// Read by the app (with the cache bypassed) to notice that a newer demo has been published.
writeFileSync(join(dir, 'version.json'), JSON.stringify({ build: process.env.EXPO_PUBLIC_DEMO_BUILD ?? 'local' }));
console.log(`Demo ready in ${dir}`);
