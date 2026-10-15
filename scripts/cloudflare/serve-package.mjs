import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { inside } from './common.mjs';
import { verifyPackage } from './package.mjs';

const option = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = resolve(option('package') || 'cloudflare-release/package');
verifyPackage(directory);
const root = resolve(directory, 'site');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\//, '');
    if (pathname === '_headers' || pathname.includes('..') || pathname.includes('\\')) { response.writeHead(404).end(); return; }
    const name = pathname && existsSync(resolve(root, pathname)) ? pathname : 'index.html';
    const bytes = readFileSync(inside(root, name));
    response.writeHead(200, { 'Content-Type': types[extname(name)] || 'application/octet-stream', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': name === 'bank/catalogue.json' ? 'no-cache' : 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404).end(); }
});
server.listen(Number(option('port') || 5230), '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
