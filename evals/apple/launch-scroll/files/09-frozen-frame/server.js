import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT ?? 8080);
