/**
 * The launch-page token sets: reads skills/apple/launch-page/assets/tokens.json and renders tokens.css (restrained on
 * :root, expressive on :root[data-launch-mode="expressive"]) and theme.tailwind.css (Tailwind v4 @theme variables).
 * gen.mjs writes both files; validateTokens() holds the design rules every set must keep.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR } from './vendor.mjs';

export const TOKENS_DIR = `${SKILL_DIR}/launch-page/assets`;
export const TOKENS_SOURCE = `${TOKENS_DIR}/tokens.json`;
export const TOKENS_CSS = `${TOKENS_DIR}/tokens.css`;
export const TAILWIND_CSS = `${TOKENS_DIR}/theme.tailwind.css`;
export const EXPRESSIVE = ':root[data-launch-mode="expressive"]';
export const MIN_CONTRAST = 4.5;
export const VIETNAMESE_HEADING_FLOOR = 1.1;

export function loadTokens(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ...TOKENS_SOURCE.split('/')), 'utf8'));
}

export const ladderSize = (scale, step) => Math.round(scale.base * scale.ratio ** step);

export const gridUp = (value, grid) => Math.ceil(value / grid - 1e-9) * grid;

export function leadingFor(scale, style, size) {
  const factor = style.leading ?? (style.kind === 'text' ? scale.textLeading : scale.displayLeading);
  return gridUp(size * factor, scale.grid);
}

const em = (value) => `${Number(value.toFixed(3))}em`;
const px = (value) => `${Number(value.toFixed(3))}px`;
const rem = (value) => `${Number((value / 16).toFixed(4))}rem`;

export function trackingFor(tokens, size) {
  const value = tokens.tracking[String(size)];
  if (value === undefined) throw new Error(`tokens.json has no tracking for a ${size}px rung`);
  return value;
}

export function restrainedStyles(tokens) {
  const breakpoints = ['base', ...Object.keys(tokens.breakpoints)];
  return Object.entries(tokens.styles).map(([name, style]) => {
    const rungs = {};
    let current = null;
    for (const breakpoint of breakpoints) {
      if (style.steps[breakpoint] !== undefined) current = style.steps[breakpoint];
      if (current === null) continue;
      const size = ladderSize(tokens.typeScale, current);
      const previous = Object.values(rungs).at(-1);
      if (previous?.size === size) continue;
      rungs[breakpoint] = { size, leading: leadingFor(tokens.typeScale, style, size), tracking: trackingFor(tokens, size), weight: tokens.weights[style.kind] };
    }
    return { name, kind: style.kind, rungs };
  });
}

export function fluidSize(expressive, [min, max]) {
  const slope = (max - min) / (expressive.fluidTo - expressive.fluidFrom);
  const intercept = min - slope * expressive.fluidFrom;
  return `clamp(${rem(min)}, ${rem(intercept)} + ${Number((slope * 100).toFixed(4))}vw, ${rem(max)})`;
}

const roundLeading = (name, factor, grid) => `round(up, calc(var(--type-${name}-size) * ${factor}), ${grid}px)`;

function luminance(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

export function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export function validateTokens(tokens) {
  const problems = [];
  for (const scheme of ['light', 'dark']) {
    const palette = tokens.colors[scheme];
    for (const [fg, bg] of tokens.colors.textPairs) {
      const ratio = contrast(palette[fg], palette[bg]);
      if (ratio < MIN_CONTRAST) problems.push(`${scheme} ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
    for (const [name, accent] of Object.entries(tokens.colors.sectionAccents)) {
      for (const bg of ['bg', 'surface']) {
        const ratio = contrast(accent[scheme], palette[bg]);
        if (ratio < MIN_CONTRAST) problems.push(`${scheme} section accent ${name} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  for (const style of restrainedStyles(tokens)) {
    for (const [breakpoint, rung] of Object.entries(style.rungs)) {
      if (!Number.isInteger(rung.leading) || rung.leading % tokens.typeScale.grid) problems.push(`${style.name} at ${breakpoint}: leading ${rung.leading} is off the ${tokens.typeScale.grid}px grid`);
      if (style.kind === 'display' && rung.leading / rung.size < VIETNAMESE_HEADING_FLOOR) problems.push(`${style.name} at ${breakpoint}: leading ${rung.leading}/${rung.size} is under ${VIETNAMESE_HEADING_FLOOR}`);
    }
  }
  for (const [name, style] of Object.entries(tokens.expressive.styles)) {
    if (style.kind === 'display' && style.leading < VIETNAMESE_HEADING_FLOOR) problems.push(`expressive ${name}: leading ${style.leading} is under ${VIETNAMESE_HEADING_FLOOR}`);
  }
  for (const value of Object.values(tokens.spacing.ladder)) if (value % (tokens.spacing.step / 2)) problems.push(`spacing ${value}px is off the ${tokens.spacing.step}px scale`);
  return problems;
}

const block = (selector, declarations) => [`${selector} {`, ...declarations.map((line) => `  ${line}`), '}'];
const media = (query, lines) => [`@media ${query} {`, ...lines.map((line) => `  ${line}`), '}'];
const decl = (name, value) => `--${name}: ${value};`;

function styleDeclarations(name, rung) {
  return [
    decl(`type-${name}-size`, px(rung.size)),
    decl(`type-${name}-leading`, px(rung.leading)),
    decl(`type-${name}-tracking`, em(rung.tracking)),
    decl(`type-${name}-weight`, rung.weight),
  ];
}

const responsive = (value) => (typeof value === 'object' ? value : { base: value });

function colorDeclarations(palette) {
  return Object.entries(palette).map(([name, value]) => decl(`color-${name}`, value));
}

export function buildTokensCss(tokens) {
  const problems = validateTokens(tokens);
  if (problems.length) throw new Error(`tokens.json breaks its own rules:\n${problems.join('\n')}`);
  const breakpoints = Object.entries(tokens.breakpoints);
  const styles = restrainedStyles(tokens);
  const rootLines = [
    'color-scheme: light dark;',
    decl('font-sans', tokens.fonts.sans.join(', ')),
    decl('font-mono', tokens.fonts.mono.join(', ')),
    ...Object.entries(tokens.spacing.ladder).sort((a, b) => a[1] - b[1]).map(([name, value]) => decl(`space-${name}`, px(value))),
    ...styles.flatMap((style) => styleDeclarations(style.name, style.rungs.base)),
    ...colorDeclarations(tokens.colors.light),
    ...Object.entries(tokens.layout).map(([name, value]) => decl(name, responsive(value).base)),
    ...Object.entries(tokens.radii).map(([name, value]) => decl(`radius-${name}`, value)),
    decl('focus-width', tokens.focus.width),
    decl('focus-offset', tokens.focus.offset),
    ...Object.entries(tokens.motion).map(([name, value]) => decl(name, value)),
    decl('scene-progress', '1'),
  ];
  const lines = [
    '/* launch-page tokens.css (design-pro-max). Generated from tokens.json; copy it into the project as it is.',
    ' * Restrained set on :root; expressive set on :root[data-launch-mode="expressive"]. Components read the custom',
    ' * properties only, so a mode switch, a dark scheme, reduced motion or a :lang() override edits no component. */',
    ...block(':root', rootLines),
  ];
  for (const [name, width] of breakpoints) {
    const inner = [
      ...styles.flatMap((style) => (style.rungs[name] ? styleDeclarations(style.name, style.rungs[name]) : [])),
      ...Object.entries(tokens.layout).flatMap(([key, value]) => (responsive(value)[name] ? [decl(key, responsive(value)[name])] : [])),
    ];
    if (inner.length) lines.push('', ...media(`(min-width: ${width}px)`, block(':root', inner)));
  }
  const dark = colorDeclarations(tokens.colors.dark);
  lines.push('', ...media('(prefers-color-scheme: dark)', block(':root:not([data-theme="light"])', dark)), '', ...block(':root[data-theme="dark"]', dark));
  lines.push('', ...block(':root[data-theme="light"]', ['color-scheme: light;']), '', ...block(':root[data-theme="dark"]', ['color-scheme: dark;']));
  const expressive = tokens.expressive;
  const expressiveLines = [
    ...Object.entries(expressive.styles).flatMap(([name, style]) => [
      decl(`type-${name}-size`, fluidSize(expressive, style.fluid)),
      decl(`type-${name}-leading`, roundLeading(name, style.leading, tokens.typeScale.grid)),
      decl(`type-${name}-tracking`, em(style.tracking)),
    ]),
    ...Object.entries(expressive.motion).map(([name, value]) => decl(name, value)),
    ...Object.entries(expressive.layout).map(([name, value]) => decl(name, responsive(value).base)),
    decl('section-accent', `var(--color-${expressive.sectionAccent})`),
  ];
  lines.push('', ...block(EXPRESSIVE, expressiveLines));
  for (const [name, width] of breakpoints) {
    const inner = Object.entries(expressive.layout).flatMap(([key, value]) => (responsive(value)[name] ? [decl(key, responsive(value)[name])] : []));
    if (inner.length) lines.push('', ...media(`(min-width: ${width}px)`, block(EXPRESSIVE, inner)));
  }
  for (const [name, accent] of Object.entries(tokens.colors.sectionAccents)) {
    lines.push('', ...block(`${EXPRESSIVE} [data-section-accent="${name}"]`, [decl('section-accent', accent.light)]));
  }
  const darkAccents = Object.entries(tokens.colors.sectionAccents).flatMap(([name, accent]) => [
    ...block(`${EXPRESSIVE}:not([data-theme="light"]) [data-section-accent="${name}"]`, [decl('section-accent', accent.dark)]),
  ]);
  lines.push('', ...media('(prefers-color-scheme: dark)', darkAccents));
  for (const [name, accent] of Object.entries(tokens.colors.sectionAccents)) {
    lines.push('', ...block(`${EXPRESSIVE}[data-theme="dark"] [data-section-accent="${name}"]`, [decl('section-accent', accent.dark)]));
  }
  const reduced = Object.entries(tokens.reducedMotion).map(([name, value]) => decl(name, value));
  lines.push('', ...media('(prefers-reduced-motion: reduce)', block(`:root, ${EXPRESSIVE}`, reduced)), '', ...block(`:root.reduced-motion, ${EXPRESSIVE}.reduced-motion`, reduced));
  const styleNames = Object.keys(tokens.styles);
  for (const [lang, fonts] of Object.entries(tokens.langFonts)) {
    const selector = `:lang(${lang}), ${EXPRESSIVE}:lang(${lang})`;
    lines.push('', ...block(selector, [
      decl('font-sans', fonts.join(', ')),
      ...styleNames.flatMap((name) => {
        const factor = tokens.styles[name].kind === 'text' ? tokens.typeScale.langTextLeading : tokens.typeScale.langDisplayLeading;
        return [decl(`type-${name}-tracking`, '0em'), decl(`type-${name}-leading`, roundLeading(name, factor, tokens.typeScale.grid))];
      }),
    ]));
  }
  return `${lines.join('\n')}\n`;
}

export function buildTailwindTheme(tokens) {
  const styles = restrainedStyles(tokens);
  const theme = [
    decl('font-sans', tokens.fonts.sans.join(', ')),
    decl('font-mono', tokens.fonts.mono.join(', ')),
    decl('breakpoint-*', 'initial'),
    ...Object.entries(tokens.breakpoints).map(([name, width]) => decl(`breakpoint-${name}`, px(width))),
    decl('spacing', px(tokens.spacing.step / 2)),
  ];
  for (const style of styles) {
    for (const [breakpoint, rung] of Object.entries(style.rungs)) {
      const name = breakpoint === 'base' ? style.name : `${style.name}-${breakpoint}`;
      theme.push(decl(`text-${name}`, px(rung.size)), decl(`text-${name}--line-height`, px(rung.leading)), decl(`text-${name}--letter-spacing`, em(rung.tracking)), decl(`text-${name}--font-weight`, rung.weight));
    }
  }
  theme.push(
    ...Object.entries(tokens.colors.light).map(([name, value]) => decl(`color-${name}`, value)),
    ...Object.entries(tokens.colors.dark).map(([name, value]) => decl(`color-${name}-dark`, value)),
    ...Object.entries(tokens.colors.sectionAccents).flatMap(([name, accent]) => [decl(`color-section-${name}`, accent.light), decl(`color-section-${name}-dark`, accent.dark)]),
    ...Object.entries(tokens.radii).map(([name, value]) => decl(`radius-${name}`, value)),
    decl('container-content', tokens.layout['content-max']),
    decl('container-measure', tokens.layout.measure),
    decl('ease-out-launch', tokens.motion['ease-out']),
    decl('ease-standard', tokens.motion['ease-standard']),
    decl('animate-reveal', `reveal ${tokens.motion['duration-reveal']} ${tokens.motion['ease-out']} both`),
    decl('animate-marquee', `marquee ${tokens.motion['duration-marquee']} linear infinite`),
  );
  const keyframes = [
    '',
    '@keyframes reveal {',
    `  from { opacity: 0; translate: 0 ${tokens.motion['reveal-rise']}; }`,
    '  to { opacity: 1; translate: 0 0; }',
    '}',
    '',
    '@keyframes marquee {',
    '  to { translate: -50% 0; }',
    '}',
  ];
  const expressive = tokens.expressive;
  const lines = [
    '/* launch-page theme.tailwind.css (design-pro-max). Generated from tokens.json: the token sets as Tailwind v4 @theme',
    ' * variables. Import it after tailwindcss. Responsive rungs are separate names (text-hero sm:text-hero-sm ...); the',
    ' * expressive mode and reduced motion override the same variables outside @theme. The default breakpoints are cleared',
    ' * so every breakpoint is one of the set\'s, in px. */',
    '@theme {',
    ...theme.map((line) => `  ${line}`),
    ...keyframes.map((line) => (line ? `  ${line}` : line)),
    '}',
    '',
    ...block('[data-launch-mode="expressive"]', Object.entries(expressive.styles).flatMap(([name, style]) => [
      decl(`text-${name}`, fluidSize(expressive, style.fluid)),
      decl(`text-${name}--line-height`, `round(up, calc(var(--text-${name}) * ${style.leading}), ${tokens.typeScale.grid}px)`),
      decl(`text-${name}--letter-spacing`, em(style.tracking)),
    ])),
    '',
    ...media('(prefers-reduced-motion: reduce)', block(':root', [decl('animate-reveal', 'none'), decl('animate-marquee', 'none')])),
    '',
    ...block(':root.reduced-motion', [decl('animate-reveal', 'none'), decl('animate-marquee', 'none')]),
  ];
  return `${lines.join('\n')}\n`;
}
