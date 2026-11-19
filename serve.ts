// A tiny static server for app/ (Node 22, standard library only), so the
// guide can be run locally without a build step. `node serve.ts` serves
// app/ on http://localhost:8080; `--port <n>` picks another port, `--host
// <h>` binds elsewhere, `--quiet` silences the per-request log. It sends
// the MIME types a browser needs, answers HEAD with headers only, refuses
// any path outside app/, and otherwise does nothing clever. This is a
// development convenience for previewing the guide, not a web server for
// the internet — it serves only the files under app/ and nothing else.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function readFlag(flag: string, fallback: string): string {
  const at = process.argv.indexOf(flag);
  if (at === -1) return fallback;
  return process.argv[at + 1] || fallback;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parsePort(raw: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const port = parsePort(readFlag('--port', '8080'));
const host = readFlag('--host', '127.0.0.1');
const quiet = hasFlag('--quiet');

// Resolve a request path to a file inside app/, or null when it escapes.
function fileInsideApp(requestPath: string): string | null {
  const cleaned = requestPath.endsWith('/') ? requestPath + 'index.html' : requestPath;
  const file = resolve(join(appRoot, normalize(cleaned)));
  if (file !== appRoot && !file.startsWith(appRoot + sep)) return null;
  return file;
}

function mimeTypeFor(file: string): string {
  return MIME_BY_EXT[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// One line of log per request, unless --quiet silenced it. The status
// goes to stderr so the startup line on stdout stays clean.
function logRequest(method: string | undefined, path: string, status: number): void {
  if (!quiet) console.error(`${method} ${path} -> ${status}`);
}

createServer((request, response) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    logRequest(request.method, request.url ?? '/', 400);
    response.writeHead(400).end('bad request');
    return;
  }
  const file = fileInsideApp(pathname);
  if (file === null) {
    logRequest(request.method, pathname, 403);
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    logRequest(request.method, pathname, 404);
    response.writeHead(404).end('not found');
    return;
  }
  logRequest(request.method, pathname, 200);
  response.writeHead(200, {
    'content-type': mimeTypeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  // HEAD asks for the headers only; GET gets the body.
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`app/ is on http://${host}:${port}`);
});
