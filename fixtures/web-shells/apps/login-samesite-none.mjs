import { createLoginApp } from '../../../skills/apple/web-shells/assets/login/app.mjs';

export default createLoginApp({ verify: (user, password) => user === 'demo' && password === 'demo', sameSite: 'None' });
