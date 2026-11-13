/**
 * menubar-widgets static scan: reads Swift sources without building them and reports the menu bar and widget
 * anti-patterns this part has rules for. It runs anywhere Node runs.
 *
 *   node scan-swift.mjs [--configurable <kind>[,<kind>...]] <file or folder> [...]
 *
 * Errors: MW-APPEAR-01, an observation of effectiveAppearance (KVO observe with a rooted or bare key path, a Combine
 * publisher chain ending in sink or assign, or observeValue for the key path) whose handler, or a function it calls in
 * the same file, marks a view for display, replaces its image, title or tint or sets its layer contents, where no
 * earlier guard (or enclosing if) compares a value with a stored property and no removeDuplicates precedes the sink;
 * MW-CONFIG-01, a StaticConfiguration widget in sources that declare a WidgetConfigurationIntent no
 * AppIntentConfiguration uses, or a StaticConfiguration whose kind --configurable names (the kind string, its constant
 * or the constant's name). Warnings: MW-APPEAR-01 for an observation this scan cannot follow; MW-WARN-KIND, a widget
 * kind written as a string literal instead of a shared constant; MW-WARN-PARAMS, an intent used by
 * AppIntentConfiguration with no @Parameter. Output follows the shared checker contract; exit 1 only for an error rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY = 'Proof boundary: a static read of Swift text in the files given; it follows calls one file deep, does not build or run the code, and cannot see handlers in other files, generated code or runtime appearance changes. Profile the running app with sample for the CPU loop and open Edit Widget for the options.';

const SKIPPED_FOLDERS = new Set(['.build', 'build', 'DerivedData', 'Pods', '.git', 'node_modules']);
const KEY_PATH = String.raw`\\(?:\w+(?:\.\w+)*)?\.effectiveAppearance\b`;
const OBSERVATION = new RegExp(String.raw`\bobserve\s*\(\s*${KEY_PATH}|\bpublisher\s*\(\s*for:\s*${KEY_PATH}|forKeyPath:\s*(?:"effectiveAppearance"|#keyPath\([^)]*effectiveAppearance\))`, 'g');
const OBSERVING_API = /\bobserve\s*\(|\bpublisher\s*\(\s*for:|\bobserveValue\s*\(|\baddObserver\s*\(/;
const REDRAW = /\bneedsDisplay\s*=\s*true|\bsetNeedsDisplay\b|\.display\s*\(\s*\)|\bdisplayIfNeeded\s*\(\s*\)|\bneedsLayout\s*=\s*true|\.(?:image|attributedTitle|title|alternateImage|contentTintColor)\s*=(?!=)|\blayer\??\.contents\s*=(?!=)/g;
const ASSIGNED_REDRAW = /\\(?:\w+)?\.(?:image|attributedTitle|title|alternateImage|contentTintColor|needsDisplay)\b/;
const CALL = /\b([a-z_]\w*)\s*\(/gi;
const KEYWORDS = new Set(['if', 'guard', 'switch', 'for', 'while', 'return', 'init', 'self', 'super', 'print', 'func', 'let', 'var', 'case', 'catch', 'repeat', 'assumeIsolated']);
const TYPE_BODY = /\b(?:class|struct|enum|actor|extension)\b[^{}();]*$/;

export function listFiles(inputs) {
  const files = [];
  const visit = (target) => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) throw new UsageError(`Not found: ${target}`);
    if (stat.isFile()) {
      if (target.endsWith('.swift')) files.push(target);
      return;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && SKIPPED_FOLDERS.has(entry.name)) continue;
      visit(path.join(target, entry.name));
    }
  };
  for (const input of inputs) visit(input);
  return files;
}

export function stripComments(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const two = text.slice(index, index + 2);
    if (two === '//') {
      const end = text.indexOf('\n', index);
      const stop = end < 0 ? text.length : end;
      out += ' '.repeat(stop - index);
      index = stop;
    } else if (two === '/*') {
      const end = text.indexOf('*/', index + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(index, stop).replace(/[^\n]/g, ' ');
      index = stop;
    } else if (text[index] === '"') {
      const triple = text.startsWith('"""', index);
      const close = triple ? text.indexOf('"""', index + 3) : findQuote(text, index + 1);
      const stop = close < 0 ? text.length : close + (triple ? 3 : 1);
      out += text.slice(index, stop);
      index = stop;
    } else {
      out += text[index];
      index += 1;
    }
  }
  return out;
}

function findQuote(text, from) {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1;
    else if (text[index] === '"' || text[index] === '\n') return index;
  }
  return -1;
}

const PAIRS = { '(': ')', '[': ']', '{': '}' };

export function closeOf(text, open) {
  const stack = [];
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      const close = findQuote(text, index + 1);
      if (close < 0) return text.length;
      index = close;
    } else if (PAIRS[char]) stack.push(PAIRS[char]);
    else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return index;
    }
  }
  return text.length;
}

export function blockAfter(text, from) {
  const open = text.indexOf('{', from);
  if (open < 0) return null;
  const end = Math.min(closeOf(text, open) + 1, text.length);
  return { start: open, end, body: text.slice(open, end) };
}

function functionRange(text, name) {
  const match = new RegExp(`\\bfunc\\s+${name}\\s*[(<]`).exec(text);
  if (!match) return null;
  const block = blockAfter(text, match.index);
  return block ? { start: block.start, end: block.end } : null;
}

export function functionBody(text, name) {
  const range = functionRange(text, name);
  return range ? text.slice(range.start, range.end) : null;
}

const skipSpace = (text, index) => {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
};

function callAt(text, from) {
  const open = skipSpace(text, from);
  if (text[open] !== '(') return null;
  const close = closeOf(text, open);
  const after = skipSpace(text, close + 1);
  const trailing = text[after] === '{' ? { start: after, end: closeOf(text, after) + 1 } : null;
  return { args: { start: open + 1, end: close }, trailing, end: trailing ? trailing.end : close + 1 };
}

function chainAfter(text, from) {
  const links = [];
  let index = from;
  for (;;) {
    const dot = skipSpace(text, index);
    const match = /^\.([A-Za-z_]\w*)/.exec(text.slice(dot, dot + 80));
    if (!match) return links;
    let end = dot + match[0].length;
    const call = callAt(text, end);
    const trailing = call ? call.trailing : text[skipSpace(text, end)] === '{' ? { start: skipSpace(text, end), end: closeOf(text, skipSpace(text, end)) + 1 } : null;
    if (call) end = call.end;
    else if (trailing) end = trailing.end;
    links.push({ name: match[1], args: call?.args ?? null, trailing });
    index = end;
  }
}

function argumentHandler(text, args, label) {
  if (!args) return null;
  const inner = text.slice(args.start, args.end);
  const match = new RegExp(`\\b${label}:\\s*`).exec(inner);
  if (!match) return null;
  const at = args.start + match.index + match[0].length;
  if (text[at] === '{') return { start: at, end: closeOf(text, at) + 1 };
  const reference = /^(?:self\??\.)?([A-Za-z_]\w*)/.exec(text.slice(at, at + 80));
  return reference ? functionRange(text, reference[1]) : null;
}

function resolveHandler(text, match) {
  if (match[0].startsWith('forKeyPath')) return { handler: functionRange(text, 'observeValue'), deduplicated: false };
  const open = text.indexOf('(', match.index);
  const call = callAt(text, open);
  if (!call) return { handler: null, deduplicated: false };
  if (match[0].startsWith('observe')) return { handler: call.trailing ?? argumentHandler(text, call.args, 'changeHandler'), deduplicated: false };
  const links = chainAfter(text, call.end);
  const sinkIndex = links.findIndex((link) => link.name === 'sink' || link.name === 'assign');
  if (sinkIndex < 0) return { handler: null, deduplicated: false };
  const deduplicated = links.slice(0, sinkIndex).some((link) => link.name === 'removeDuplicates');
  const sink = links[sinkIndex];
  if (sink.name === 'assign') {
    const assigned = sink.args && ASSIGNED_REDRAW.test(text.slice(sink.args.start, sink.args.end));
    return { handler: sink.args, assigned, deduplicated };
  }
  return { handler: sink.trailing ?? argumentHandler(text, sink.args, 'receiveValue'), deduplicated };
}

export function bracePairs(text) {
  const pairs = [];
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      const close = findQuote(text, index + 1);
      if (close < 0) break;
      index = close;
    } else if (char === '{') stack.push(index);
    else if (char === '}' && stack.length) pairs.push({ open: stack.pop(), close: index });
  }
  return pairs;
}

const innermost = (pairs, position) => pairs.filter((pair) => pair.open < position && position < pair.close).reduce((best, pair) => (!best || pair.open > best.open ? pair : best), null);

export function storedProperties(text, pairs = bracePairs(text)) {
  const names = new Set();
  for (const match of text.matchAll(/\b(?:var|let)\s+([A-Za-z_]\w*)/g)) {
    const scope = innermost(pairs, match.index);
    if (!scope) {
      names.add(match[1]);
      continue;
    }
    const before = text.slice(Math.max(0, scope.open - 300), scope.open);
    const opener = before.slice(Math.max(before.lastIndexOf('}'), before.lastIndexOf('{'), before.lastIndexOf(';')) + 1);
    if (TYPE_BODY.test(opener)) names.add(match[1]);
  }
  return names;
}

const comparesStored = (condition, stored, operator) => {
  if (!condition.includes(operator)) return false;
  return [...condition.matchAll(/\b(?:self\??\.)?([A-Za-z_]\w*)/g)].some((match) => stored.has(match[1]));
};

export function dominated(text, range, position, context) {
  const { pairs, stored } = context;
  const inRange = (index) => index >= range.start && index < position;
  for (const match of text.slice(range.start, position).matchAll(/\bguard\b/g)) {
    const at = range.start + match.index;
    const elseAt = text.indexOf('else', at);
    const open = text.indexOf('{', elseAt);
    if (elseAt < 0 || open < 0 || !inRange(open)) continue;
    const close = closeOf(text, open);
    const scope = innermost(pairs, at);
    const covers = !scope || (scope.open < position && position < scope.close);
    if (close < position && covers && comparesStored(text.slice(at + 5, elseAt), stored, '!=')) return true;
  }
  for (const match of text.slice(range.start, position).matchAll(/\bif\b/g)) {
    const at = range.start + match.index;
    const open = text.indexOf('{', at);
    if (open < 0) continue;
    const close = closeOf(text, open);
    const condition = text.slice(at + 2, open);
    if (open < position && position < close && comparesStored(condition, stored, '!=')) return true;
    const scope = innermost(pairs, at);
    const covers = !scope || (scope.open < position && position < scope.close);
    if (close < position && covers && comparesStored(condition, stored, '==') && /\breturn\b/.test(text.slice(open, close))) return true;
  }
  return false;
}

function analyse(text, range, context, seen = new Set()) {
  let redraws = false;
  let unguarded = false;
  const body = text.slice(range.start, range.end);
  const events = [...body.matchAll(REDRAW)].map((match) => ({ at: range.start + match.index, needsGuard: true }));
  for (const match of body.matchAll(CALL)) {
    const name = match[1];
    if (KEYWORDS.has(name) || seen.has(name)) continue;
    const callee = functionRange(text, name);
    if (!callee || (callee.start <= range.start && range.end <= callee.end)) continue;
    const inner = analyse(text, callee, context, new Set([...seen, name]));
    if (inner.redraws) events.push({ at: range.start + match.index, needsGuard: inner.unguarded });
  }
  for (const event of events) {
    redraws = true;
    if (event.needsGuard && !dominated(text, range, event.at, context)) unguarded = true;
  }
  return { redraws, unguarded };
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

export function appearanceObservations(source) {
  const text = stripComments(source);
  const pairs = bracePairs(text);
  const context = { pairs, stored: storedProperties(text, pairs) };
  const found = [];
  for (const match of text.matchAll(OBSERVATION)) {
    const line = lineAt(text, match.index);
    const { handler, assigned, deduplicated } = resolveHandler(text, match);
    if (!handler) {
      found.push({ line, redraws: false, guarded: false, handler: false });
      continue;
    }
    if (assigned !== undefined) {
      found.push({ line, redraws: Boolean(assigned), guarded: deduplicated, handler: true });
      continue;
    }
    const result = analyse(text, handler, context);
    found.push({ line, redraws: result.redraws, guarded: deduplicated || !result.unguarded, handler: true });
  }
  return found;
}

export function untracedObservation(source) {
  const text = stripComments(source);
  return /\beffectiveAppearance\b/.test(text) && OBSERVING_API.test(text) && ![...text.matchAll(OBSERVATION)].length;
}

export function widgetFacts(source) {
  const text = stripComments(source);
  const intents = [...text.matchAll(/\b(?:struct|class)\s+(\w+)\s*:\s*[^{]*\bWidgetConfigurationIntent\b/g)].map((match) => {
    const block = blockAfter(text, match.index + match[0].length);
    return { name: match[1], line: lineAt(text, match.index), parameters: /@Parameter\b/.test(block?.body ?? '') };
  });
  const configurations = [...text.matchAll(/\b(StaticConfiguration|AppIntentConfiguration)\s*\(/g)].map((match) => {
    const call = callAt(text, match.index + match[0].length - 1);
    const args = call ? text.slice(call.args.start, call.args.end) : text.slice(match.index, match.index + 400);
    const intent = /\bintent:\s*([\w.]+)\.self/.exec(args)?.[1]?.split('.').pop() ?? null;
    const kind = /^\s*kind:\s*([^,]+?)\s*(?:,|$)/.exec(args)?.[1] ?? null;
    const literal = kind && /^"(?:[^"\\\n]|\\.)*"$/.test(kind) ? kind : null;
    return { type: match[1], line: lineAt(text, match.index), intent, kind, literalKind: literal };
  });
  const constants = Object.fromEntries([...text.matchAll(/\b(?:let|var)\s+([A-Za-z_]\w*)\s*(?::\s*String\s*)?=\s*"((?:[^"\\\n]|\\.)*)"/g)].map((match) => [match[1], match[2]]));
  return { intents, configurations, constants };
}

export function kindNames(configuration, constants) {
  if (!configuration.kind) return [];
  if (configuration.literalKind) return [configuration.literalKind.slice(1, -1)];
  const last = configuration.kind.split('.').pop();
  return [configuration.kind, last, constants[last]].filter(Boolean);
}

export function scanSources(files, report, { configurable = [], label = (file) => file } = {}) {
  const intents = [];
  const configurations = [];
  const constants = {};
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const observation of appearanceObservations(source)) {
      const where = `${label(file)}:${observation.line}`;
      if (!observation.handler) report.warn('MW-APPEAR-01', where, 'an effectiveAppearance observation whose handler this scan cannot find', 'a handler that redraws only when the light or dark match changes');
      else if (observation.redraws && !observation.guarded) report.error('MW-APPEAR-01', where, 'the effectiveAppearance handler redraws without an earlier comparison with the last value', 'compare bestMatch(from: [.darkAqua, .aqua]) with a stored last value and return before redrawing when it has not changed, or put removeDuplicates() before the sink');
      else report.pass('MW-APPEAR-01', where, observation.redraws ? 'redraw only after a comparison with a stored last value' : 'no redraw reachable from the handler in this file', 'redraw only when the light or dark match changes');
    }
    if (untracedObservation(source)) report.warn('MW-APPEAR-01', label(file), 'this file observes something and mentions effectiveAppearance, but the scan found no effectiveAppearance observation it can follow', 'an observe(\\.effectiveAppearance), publisher(for: \\.effectiveAppearance) or observeValue(forKeyPath:) the scan can read; check the handler by hand');
    const facts = widgetFacts(source);
    intents.push(...facts.intents.map((intent) => ({ ...intent, file })));
    configurations.push(...facts.configurations.map((configuration) => ({ ...configuration, file })));
    Object.assign(constants, facts.constants);
  }
  const used = new Set(configurations.filter((item) => item.type === 'AppIntentConfiguration').map((item) => item.intent));
  const unused = intents.filter((intent) => !used.has(intent.name));
  const statics = configurations.filter((item) => item.type === 'StaticConfiguration');
  const requested = (item) => kindNames(item, constants).some((name) => configurable.includes(name));
  for (const item of statics) {
    const where = `${label(item.file)}:${item.line}`;
    if (unused.length) report.error('MW-CONFIG-01', where, `StaticConfiguration while ${unused.map((intent) => intent.name).join(', ')} is declared and no AppIntentConfiguration uses it; Edit Widget shows no options`, 'AppIntentConfiguration(kind:intent:provider:) with that intent, keeping the same kind string');
    else if (requested(item)) report.error('MW-CONFIG-01', where, `StaticConfiguration for ${item.kind}, which --configurable says should offer options; Edit Widget shows none`, 'AppIntentConfiguration with a WidgetConfigurationIntent whose parameters use AppEntity types, keeping the same kind string');
    else report.pass('MW-CONFIG-01', where, `StaticConfiguration for ${item.kind ?? 'a widget'}, with no configuration requested for it`, 'pass --configurable <kind> for a widget that should offer options');
  }
  for (const name of configurable) {
    if (!configurations.some((item) => kindNames(item, constants).includes(name))) report.warn('MW-CONFIG-01', name, `no widget configuration with the kind ${name} in these files`, 'name the kind string, its constant or the constant\'s name, and scan the widget sources');
  }
  if (!statics.length) {
    for (const intent of unused) report.warn('MW-CONFIG-01', `${label(intent.file)}:${intent.line}`, `${intent.name} is declared but no AppIntentConfiguration in these files uses it`, 'scan the widget sources too, or use the intent');
  }
  for (const item of configurations.filter((entry) => entry.type === 'AppIntentConfiguration')) {
    const intent = intents.find((candidate) => candidate.name === item.intent);
    const where = `${label(item.file)}:${item.line}`;
    report.pass('MW-CONFIG-01', where, `AppIntentConfiguration with ${item.intent ?? 'an intent'}`, 'options in Edit Widget');
    if (intent && !intent.parameters) report.warn('MW-WARN-PARAMS', where, `${intent.name} has no @Parameter`, 'at least one @Parameter, an AppEntity for a list of choices');
  }
  for (const item of configurations.filter((entry) => entry.literalKind)) {
    report.warn('MW-WARN-KIND', `${label(item.file)}:${item.line}`, `kind written as the literal ${item.literalKind}`, 'one shared constant used by the widget and by every reloadTimelines(ofKind:) call, never renamed after release');
  }
}

export function parseArguments(args) {
  const inputs = [];
  const configurable = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--configurable') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new UsageError('--configurable needs the kinds that should offer options: --configurable <kind>[,<kind>...]');
      configurable.push(...value.split(',').map((kind) => kind.trim()).filter(Boolean));
      index += 1;
    } else if (args[index].startsWith('--')) throw new UsageError(`Unknown option ${args[index]}.`);
    else inputs.push(args[index]);
  }
  if (!inputs.length) throw new UsageError('Usage: node scan-swift.mjs [--configurable <kind>[,<kind>...]] <file or folder> [...]');
  return { inputs, configurable };
}

async function main() {
  const { inputs, configurable } = parseArguments(process.argv.slice(2));
  const files = listFiles(inputs);
  if (!files.length) throw new UsageError('No .swift file found.');
  const report = createReport({ tool: 'scan-swift', boundary: BOUNDARY });
  scanSources(files, report, { configurable, label: (file) => path.relative(process.cwd(), file) || file });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
