const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Status</title></head><body>
<h1>Status</h1>
<p id="orders">Loading</p>
<iframe src="/admin/" title="Admin" width="600" height="300"></iframe>
<script>
fetch('/api/stats').then((response) => { document.getElementById('orders').textContent = 'API answered ' + response.status; });
</script>
</body></html>`;

const challenge = (response) => {
  response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end('');
};

export default function handler(request, response) {
  const { pathname } = new URL(request.url ?? '/', 'https://app.invalid');
  if (pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(page);
    return;
  }
  if ((pathname.startsWith('/admin/') || pathname.startsWith('/api/')) && !/^Basic\s/i.test(request.headers.authorization ?? '')) return challenge(response);
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end('not found');
}
