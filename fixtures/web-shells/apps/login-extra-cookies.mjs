import { createLoginApp } from '../../../skills/apple/web-shells/assets/login/app.mjs';

const login = createLoginApp({ verify: (user, password) => user === 'demo' && password === 'demo' });

const EXTRA = {
  GET: ['csrf=c0ffee; Path=/login; HttpOnly; Secure; SameSite=Strict', 'remember=; Path=/; Max-Age=-1', 'tour=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
};

export default function handler(request, response) {
  const extra = new URL(request.url ?? '/', 'https://app.invalid').pathname === '/login' ? EXTRA[request.method] ?? [] : [];
  if (extra.length) {
    const writeHead = response.writeHead.bind(response);
    response.writeHead = (status, headers = {}) => {
      const current = headers['Set-Cookie'];
      return writeHead(status, { ...headers, 'Set-Cookie': [...[current].flat().filter(Boolean), ...extra] });
    };
  }
  return login(request, response);
}
