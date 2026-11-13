/**
 * launch-page static lint: reads CSS and HTML files (style blocks, style attributes, stylesheet links) without a
 * browser, for a quick pass before check-page.mjs.
 *
 *   node lint-css.mjs <file or folder> [...]
 *
 * Error: LP-FONT-01, an SF font family, an SF font file or stylesheet URL (including '+'-encoded family lists), a font
 * from an Apple host, or an Apple private-use glyph (U+F8FF, U+F301, the SF Symbols plane from U+100000, or their CSS
 * escapes and HTML references). Warnings: LP-BASE-01 headings, ledes, calls to action or reveals hidden by a rule with
 * no capability guard that a script sets (html[data-motion], html[data-intro], a .js class; a reduced-motion query is
 * not one, since it holds without script); LP-AMB-01 infinite animations neither behind such a guard nor overridden for
 * reduced motion in the same files; LP-TYPE-01 font sizes written as literals instead of tokens, and
 * unitless line heights; LP-WARN-CLASS transitions over 300 ms on controls; LP-WARN-FOCUS outlines removed on focus
 * with nothing in their place. Output follows the shared checker contract; exit 1 only for an error rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';
import { APPLE_FONT_HOST, SF_FONT, readableUrl } from './check-page.mjs';

export { SF_FONT };
export const APPLE_GLYPHS = /[]|[\u{100000}-\u{10FFFF}]|\\0*f8ff\b|\\0*f301\b|&#x0*f8ff;|&#x0*f301;|&#63743;|&#62209;/iu;
export const CONTROL_MS = 300;
export const BOUNDARY = 'Proof boundary: a static read of CSS and HTML text; it does not resolve the cascade, scripts or computed values. Run check-page.mjs for those.';

const EXTENSIONS = new Set(['.css', '.html', '.htm']);
const GUARD = /data-motion|data-intro|\.js\b|\.motion-ok|:not\(\.no-js\)/;
const NEGATED_GUARD = /:not\([^)]*(?:data-motion|data-intro|\.js\b|\.motion-ok)/;

export const guarded = (context) => GUARD.test(context) && !NEGATED_GUARD.test(context);

export function appleGlyph(text) {
  const direct = APPLE_GLYPHS.exec(text);
  if (direct) return direct[0];
  for (const match of String(text).matchAll(/\\0*(10[0-9a-f]{4})\b|&#x0*(10[0-9a-f]{4});|&#(\d{7});/gi)) {
    const code = match[3] ? Number(match[3]) : Number.parseInt(match[1] ?? match[2], 16);
    if (code >= 0x100000 && code <= 0x10ffff) return match[0];
  }
  return null;
}

function appleHost(url) {
  try {
    return APPLE_FONT_HOST.test(new URL(url, 'https://local.invalid/').hostname);
  } catch {
    return false;
  }
}

const fontUrl = (value) => SF_FONT.test(readableUrl(value)) || [...String(value).matchAll(/url\(\s*["']?([^"')]+)/g)].some((match) => appleHost(match[1]));
const CONTENT = /\bh[1-6]\b|data-lede|data-cta|data-reveal|\.lede\b|\.cta\b|\.hero\b/;

export function listFiles(inputs) {
  const files = [];
  const visit = (target) => {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) if (name !== 'node_modules' && !name.startsWith('.')) visit(path.join(target, name));
    } else if (EXTENSIONS.has(path.extname(target).toLowerCase())) files.push(target);
  };
  for (const input of inputs) {
    if (!fs.existsSync(input)) throw new UsageError(`${input} does not exist.`);
    visit(input);
  }
  return files;
}

export function extractCss(text, file) {
  if (!/\.html?$/i.test(file)) return { css: text, links: [] };
  const blocks = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  const inline = [...text.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi)].map((match) => `x { ${match[2]} }`);
  const links = [...text.matchAll(/<link\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>/gi)].map((match) => match[2]);
  return { css: [...blocks, ...inline].join('\n'), links };
}

export function cssRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const frames = [];
  let buffer = '';
  const declare = () => {
    const part = buffer.trim();
    buffer = '';
    const colon = part.indexOf(':');
    if (colon > 0 && frames.length) frames.at(-1).declarations.push({ name: part.slice(0, colon).trim().toLowerCase(), value: part.slice(colon + 1).trim() });
  };
  for (const char of text) {
    if (char === '{') {
      frames.push({ selector: buffer.trim(), declarations: [] });
      buffer = '';
    } else if (char === '}') {
      declare();
      const frame = frames.pop();
      if (frame?.declarations.length) rules.push({ selector: frame.selector, context: frames.map((entry) => entry.selector), declarations: frame.declarations });
    } else if (char === ';') {
      declare();
    } else {
      buffer += char;
    }
  }
  return rules;
}

const durationsMs = (value) => [...String(value).matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((match) => Number(match[1]) * (match[2] === 's' ? 1000 : 1));

export function lintText(text, file, report) {
  const where = (detail) => `${file}: ${detail}`;
  const { css, links } = extractCss(text, file);
  const rules = cssRules(css);
  const fonts = [];
  for (const link of links) if (SF_FONT.test(readableUrl(link)) || appleHost(link)) fonts.push(`stylesheet ${link}`);
  for (const match of css.matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)/gi)) if (SF_FONT.test(readableUrl(match[1])) || appleHost(match[1])) fonts.push(`@import ${match[1]}`);
  for (const rule of rules) {
    for (const declaration of rule.declarations) {
      const fontish = declaration.name === 'font-family' || declaration.name === 'font' || declaration.name === 'src' || declaration.name.startsWith('--font');
      if (fontish && (SF_FONT.test(declaration.value) || fontUrl(declaration.value))) {
        fonts.push(`${rule.selector || '@font-face'} { ${declaration.name}: ${declaration.value.slice(0, 80)} }`);
      }
    }
  }
  const glyph = appleGlyph(text);
  if (glyph) fonts.push(`Apple private-use glyph ${JSON.stringify(glyph)}`);
  if (fonts.length) for (const item of fonts) report.error('LP-FONT-01', where(item), 'an SF font or symbol', 'system-ui or a licensed font first; no SF Pro, SF Pro Icons, SF Symbols or their glyphs');
  else report.pass('LP-FONT-01', where('fonts'), 'no SF font, font URL or Apple glyph', 'system-ui or a licensed font first');

  for (const rule of rules) {
    const hides = rule.declarations.some((d) => (d.name === 'opacity' && Number.parseFloat(d.value) === 0) || (d.name === 'visibility' && d.value === 'hidden'));
    const context = `${rule.context.join(' ')} ${rule.selector}`;
    if (hides && CONTENT.test(rule.selector) && !guarded(context)) report.warn('LP-BASE-01', where(rule.selector), 'content hidden by a rule with no capability guard', 'hide entrance states only behind html[data-motion="ok"] or a class script adds');
  }
  const infinite = rules.some((rule) => !guarded(`${rule.context.join(' ')} ${rule.selector}`) && rule.declarations.some((d) => /^animation(?:-iteration-count)?$/.test(d.name) && /\binfinite\b/.test(d.value)));
  if (infinite && !/prefers-reduced-motion|\.reduced-motion/.test(css)) report.warn('LP-AMB-01', where('animations'), 'an infinite animation outside html[data-motion="ok"] with no reduced-motion override', 'run self-moving content only behind the motion capability, stop it under reduced motion and give it a pause control');
  for (const rule of rules) {
    for (const declaration of rule.declarations) {
      if (declaration.name === 'font-size' && !/var\(|inherit|initial|unset|^1em$|^100%$/.test(declaration.value)) report.warn('LP-TYPE-01', where(`${rule.selector} { font-size: ${declaration.value} }`), 'a literal font size', 'a size token');
      if (declaration.name === 'line-height' && /^\d*\.?\d+$/.test(declaration.value) && declaration.value !== '0') report.warn('LP-TYPE-01', where(`${rule.selector} { line-height: ${declaration.value} }`), 'unitless leading', 'whole-pixel leading from the token set');
      if ((declaration.name === 'transition' || declaration.name === 'transition-duration') && /\b(?:button|a|summary|input|select)\b|:hover|:focus|:active|\.button|\.btn/.test(rule.selector)) {
        const slow = durationsMs(declaration.value).filter((ms) => ms > CONTROL_MS);
        if (slow.length) report.warn('LP-WARN-CLASS', where(rule.selector), `${Math.max(...slow)} ms on a control`, `controls at most ${CONTROL_MS} ms`);
      }
    }
    if (/:focus/.test(rule.selector) && rule.declarations.some((d) => d.name === 'outline' && /^(?:none|0)\b/.test(d.value)) && !rule.declarations.some((d) => d.name === 'box-shadow' || d.name === 'border-color')) {
      report.warn('LP-WARN-FOCUS', where(rule.selector), 'outline removed with nothing in its place', 'a visible focus ring of at least 2px');
    }
  }
}

async function main() {
  const inputs = dropProject(process.argv.slice(2));
  if (!inputs.length || inputs.some((arg) => arg.startsWith('--'))) throw new UsageError('Usage: node lint-css.mjs <file or folder> [...]');
  const files = listFiles(inputs);
  if (!files.length) throw new UsageError('No .css or .html file found.');
  const report = createReport({ tool: 'lint-css', boundary: BOUNDARY });
  for (const file of files) lintText(fs.readFileSync(file, 'utf8'), path.relative(process.cwd(), file) || file, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
