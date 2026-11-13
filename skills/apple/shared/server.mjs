/**
 * A static file server for checks, in two modes: `range` answers byte-range requests with 206 and advertises
 * Accept-Ranges, `200` ignores Range and always sends the whole file, like a misconfigured origin. It logs every
 * request so a checker can tell how media was fetched. It serves one folder, read-only, on 127.0.0.1.
 * With `tls` it serves HTTPS, for which createSelfSignedCert makes a throwaway certificate at run time; with `handler`
 * it serves that request handler instead of a folder.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXIT, UsageError, isMain, runMain } from './report.mjs';
import { rethrowSandbox } from './sandbox.mjs';

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

export function createSelfSignedCert(folder, hosts = ['localhost', '127.0.0.1']) {
  const key = path.join(folder, 'key.pem');
  const cert = path.join(folder, 'cert.pem');
  const names = hosts.map((name) => (/^[\d.]+$|:/.test(name) ? `IP:${name}` : `DNS:${name}`)).join(',');
  const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', `subjectAltName=${names}`], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0 || !fs.existsSync(cert)) {
    throw new UsageError('openssl could not make a self-signed certificate for the local HTTPS server.', 'Install OpenSSL (macOS and most Linux distributions ship it; otherwise macOS: brew install openssl; Windows: winget install ShiningLight.OpenSSL.Light; Debian or Ubuntu: apt install openssl) and run the check again.');
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

export function startServer({ root, mode = 'range', port = 0, host = '127.0.0.1', tls = null, handler = null } = {}) {
  if (!MODES.includes(mode)) throw new Error(`mode must be one of ${MODES.join(', ')}`);
  const base = handler ? null : fs.realpathSync.native(path.resolve(root));
  const requests = [];
  const listener = handler ?? ((request, response) => {
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
  const server = tls ? https.createServer(tls, listener) : http.createServer(listener);
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      try {
        rethrowSandbox(error);
      } catch (thrown) {
        reject(thrown);
      }
    });
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        url: `${tls ? 'https' : 'http'}://${host}:${address.port}/`,
        port: address.port,
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
  if (!root || !MODES.includes(mode) || !Number.isInteger(port)) throw new UsageError('Usage: node server.mjs <folder> [--mode range|200] [--port <n>]');
  const served = await startServer({ root, mode, port });
  process.stdout.write(`${served.url} (${mode})\n`);
  return EXIT.pass;
}

if (isMain(import.meta.url)) await runMain(() => main(process.argv));
