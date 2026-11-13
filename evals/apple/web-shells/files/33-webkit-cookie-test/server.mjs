import http from 'node:http';
import crypto from 'node:crypto';

const sessions = new Set();
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>App</title></head><body>${body}</body></html>`;

http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const session = /(?:^|; )session=([^;]+)/.exec(request.headers.cookie ?? '')?.[1];
  if (url.pathname === '/login' && request.method === 'POST') {
    const id = crypto.randomUUID();
    sessions.add(id);
    response.writeHead(303, { 'Set-Cookie': `session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax`, Location: '/app/' });
    return response.end();
  }
  if (url.pathname === '/login') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    return response.end(page('<form method="post"><input name="user"><input name="password" type="password"><button type="submit">Sign in</button></form>'));
  }
  if (!sessions.has(session)) {
    response.writeHead(303, { Location: '/login' });
    return response.end();
  }
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(page('<h1>Dashboard</h1>'));
}).listen(3000);
