import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const USER = process.env.DASHBOARD_USER ?? 'admin';
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? 'change-me';
const root = path.join(import.meta.dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript' };

function authorized(request) {
  const header = request.headers.authorization ?? '';
  if (!header.startsWith('Basic ')) return false;
  const [user, password] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  return user === USER && password === PASSWORD;
}

https.createServer({ key: fs.readFileSync(process.env.TLS_KEY), cert: fs.readFileSync(process.env.TLS_CERT) }, (request, response) => {
  if (!authorized(request)) {
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Dashboard"' });
    return response.end();
  }
  const file = path.join(root, request.url === '/' ? 'index.html' : request.url.split('?')[0]);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  response.end(fs.readFileSync(file));
}).listen(8443);
