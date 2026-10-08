import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ID = 'job-application-library';
export const HOST = '127.0.0.1';
export const PORT = 4173;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function reply(req, res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': payload.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  });
  res.end(req.method === 'HEAD' ? undefined : payload);
}

// The factory deliberately does not listen. Tests can bind an ephemeral port;
// the executable entrypoint below always uses the fixed local application origin.
export async function createLocalServer({ root = path.join(projectRoot, 'dist', 'client') } = {}) {
  const safeRoot = await realpath(root);
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      reply(req, res, 405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' });
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      reply(req, res, 400, 'Invalid path');
      return;
    }
    if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) {
      reply(req, res, 403, 'Forbidden');
      return;
    }
    if (pathname === '/health') {
      reply(req, res, 200, JSON.stringify({ app: APP_ID, pid: process.pid }), types['.json']);
      return;
    }
    const candidate = path.resolve(safeRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!inside(safeRoot, candidate)) {
      reply(req, res, 403, 'Forbidden');
      return;
    }
    try {
      // realpath also prevents a symlink within dist/client from exposing files outside it.
      const physicalPath = await realpath(candidate);
      if (!inside(safeRoot, physicalPath)) {
        reply(req, res, 403, 'Forbidden');
        return;
      }
      if (!(await stat(physicalPath)).isFile()) {
        reply(req, res, 404, 'Not found');
        return;
      }
      const data = await readFile(physicalPath);
      reply(req, res, 200, data, types[path.extname(physicalPath).toLowerCase()] || 'application/octet-stream');
    } catch {
      reply(req, res, 404, 'Not found');
    }
  });
}

async function main() {
  const server = await createLocalServer();
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port 4173 is already in use. The application will not switch ports.'
      : `Local server failed (${error.code || 'unknown error'}).`);
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => console.log(`${APP_ID} listening at http://${HOST}:${PORT}`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => {
      console.log(`${APP_ID} stopped.`);
      process.exit(0);
    }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.code === 'ENOENT'
      ? 'Built application is missing. Run npm run build before starting.'
      : `Cannot start the local application (${error.code || 'unknown error'}).`);
    process.exitCode = 1;
  });
}
