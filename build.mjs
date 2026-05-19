import { readFileSync, writeFileSync } from 'node:fs';

const tpl = readFileSync('src/index.html', 'utf8');
const strip = (js) => js
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
  .replace(/^\s*export\s+/gm, '')
  .replace(/^\s*import\s.+?;\s*$/gm, '');

const out = tpl.replace(/\/\*\s*INCLUDE:([\w./]+)\s*\*\//g, (_, file) => {
  const content = readFileSync(`src/${file}`, 'utf8');
  return (file.startsWith('vendor/') || file.endsWith('.css')) ? content : strip(content);
});

writeFileSync('ziwei-destiny.html', out);
console.log('built ziwei-destiny.html', out.length, 'bytes');
