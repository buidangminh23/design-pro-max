import fs from 'node:fs';
const feed = JSON.parse(fs.readFileSync('dist/latest.json', 'utf8'));
const served = JSON.parse(fs.readFileSync('served-platforms.json', 'utf8'));
for (const platform of served) if (!feed.platforms[platform]) throw new Error(`missing ${platform}`);
