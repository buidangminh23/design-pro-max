/**
 * web-shells fixture: a dashboard behind HTTP Basic Auth, the setup that renders blank in a home-screen web app, an
 * in-app browser or an iframe on iOS. Its default export is a request handler for probe-webkit.mjs --app.
 */
const dashboard = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dashboard</title></head><body><h1>Dashboard</h1><p>Orders today: 12</p></body></html>';

export default function handler(request, response) {
  if (!/^Basic\s/i.test(request.headers.authorization ?? '')) {
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Dashboard", charset="UTF-8"', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(dashboard);
}
