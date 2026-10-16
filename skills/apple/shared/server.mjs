/**
 * A static file server for checks, in two modes: `range` answers byte-range requests with 206 and advertises
 * Accept-Ranges, `200` ignores Range and always sends the whole file, like a misconfigured origin. It logs every
 * request so a checker can tell how media was fetched. It serves one folder, read-only, on 127.0.0.1.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { isMain } from './report.mjs';

export const MODES = ['range', '200'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

export const contentType = (file) => TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header ?? '').trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : 'unsatisfiable';
}

function resolveInside(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const target = path.resolve(root, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null;
}

export function startServer({ root, mode = 'range', port = 0, host = '127.0.0.1' } = {}) {
  if (!MODES.includes(mode)) throw new Error(`mode must be one of ${MODES.join(', ')}`);
  const base = fs.realpathSync.native(path.resolve(root));
  const requests = [];
  const server = http.createServer((request, response) => {
    const entry = { method: request.method, path: request.url, range: request.headers.range ?? null, status: 0, bytes: 0 };
    requests.push(entry);
    const send = (status, headers = {}, body = null) => {
      entry.status = status;
      entry.bytes = body ? body.length : 0;
      response.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
      response.end(request.method === 'HEAD' ? undefined : body ?? undefined);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(405, { Allow: 'GET, HEAD' });
    const file = resolveInside(base, request.url ?? '/');
    let stat;
    try {
      stat = file && fs.statSync(file);
    } catch {
      stat = null;
    }
    if (!stat?.isFile()) return send(404, { 'Content-Type': 'text/plain' }, Buffer.from('not found'));
    const bytes = fs.readFileSync(file);
    const type = contentType(file);
    if (mode === '200') return send(200, { 'Content-Type': type, 'Content-Length': bytes.length }, bytes);
    const range = request.headers.range ? parseRange(request.headers.range, bytes.length) : null;
    if (range === 'unsatisfiable') return send(416, { 'Content-Range': `bytes */${bytes.length}`, 'Accept-Ranges': 'bytes' });
    if (!range) return send(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Accept-Ranges': 'bytes' }, bytes);
    const body = bytes.subarray(range.start, range.end + 1);
    return send(206, {
      'Content-Type': type,
      'Content-Length': body.length,
      'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}`,
      'Accept-Ranges': 'bytes',
    }, body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        url: `http://${host}:${address.port}/`,
        mode,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function main(argv) {
  const args = argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args.splice(index, 2)[1] : fallback;
  };
  const mode = option('--mode', 'range');
  const port = Number(option('--port', '0'));
  const root = args[0];
  if (!root || !MODES.includes(mode) || !Number.isInteger(port)) {
    process.stderr.write('Usage: node server.mjs <folder> [--mode range|200] [--port <n>]\n');
    process.exitCode = 2;
    return;
  }
  const served = await startServer({ root, mode, port });
  process.stdout.write(`${served.url} (${mode})\n`);
}

if (isMain(import.meta.url)) await main(process.argv);
