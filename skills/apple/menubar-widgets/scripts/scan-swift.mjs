/**
 * menubar-widgets static scan: reads Swift sources without building them and reports the menu bar and widget
 * anti-patterns this part has rules for. It runs anywhere Node runs.
 *
 *   node scan-swift.mjs [--configurable] <file or folder> [...]
 *
 * Errors: MW-APPEAR-01, an observation of effectiveAppearance (KVO observe, a Combine publisher or observeValue for
 * the key path) whose handler, or a function it calls in the same file, marks a view for display or replaces its image
 * or title without first comparing the light or dark match with the last one; MW-CONFIG-01, a StaticConfiguration
 * widget in sources that declare a WidgetConfigurationIntent no AppIntentConfiguration uses, or any StaticConfiguration
 * when --configurable says the widget should offer options. Warnings: MW-WARN-KIND, a widget kind written as a string
 * literal instead of a shared constant; MW-WARN-PARAMS, an intent used by AppIntentConfiguration with no @Parameter.
 * Output follows the shared checker contract; exit 1 only for an error rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY = 'Proof boundary: a static read of Swift text in the files given; it follows calls one file deep, does not build or run the code, and cannot see handlers in other files, generated code or runtime appearance changes. Profile the running app with sample for the CPU loop and open Edit Widget for the options.';

const SKIPPED_FOLDERS = new Set(['.build', 'build', 'DerivedData', 'Pods', '.git', 'node_modules']);
const OBSERVATION = /\bobserve\s*\(\s*\\\.effectiveAppearance|\bpublisher\s*\(\s*for:\s*\\\.effectiveAppearance|forKeyPath:\s*(?:"effectiveAppearance"|#keyPath\([^)]*effectiveAppearance\))/g;
const REDRAW = /\bneedsDisplay\s*=\s*true|\bsetNeedsDisplay\b|\.display\s*\(\s*\)|\bneedsLayout\s*=\s*true|\.(?:image|attributedTitle|title|alternateImage)\s*=(?!=)/;
const MATCH = /\bbestMatch\s*\(\s*from:|\.name\s*[!=]=|\bisDark\w*\b|\bisLight\w*\b/;
const COMPARE_GUARD = /\b(?:guard|if)\b[^{\n]*(?:!=|==)/;
const CALL = /\b([a-z_]\w*)\s*\(/gi;
const KEYWORDS = new Set(['if', 'guard', 'switch', 'for', 'while', 'return', 'init', 'self', 'super', 'print', 'func', 'let', 'var', 'case', 'catch', 'repeat']);

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

export function blockAfter(text, from) {
  const open = text.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return { start: open, end: index + 1, body: text.slice(open, index + 1) };
    }
  }
  return { start: open, end: text.length, body: text.slice(open) };
}

export function functionBody(text, name) {
  const match = new RegExp(`\\bfunc\\s+${name}\\s*[(<]`).exec(text);
  return match ? blockAfter(text, match.index)?.body ?? null : null;
}

export function reachableText(text, body, depth = 3) {
  const seen = new Set();
  let collected = body;
  let frontier = [body];
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next = [];
    for (const chunk of frontier) {
      for (const match of chunk.matchAll(CALL)) {
        const name = match[1];
        if (KEYWORDS.has(name) || seen.has(name)) continue;
        seen.add(name);
        const found = functionBody(text, name);
        if (found) {
          collected += `\n${found}`;
          next.push(found);
        }
      }
    }
    frontier = next;
  }
  return collected;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

export function appearanceObservations(source) {
  const text = stripComments(source);
  const found = [];
  for (const match of text.matchAll(OBSERVATION)) {
    const keyPath = match[0].startsWith('forKeyPath');
    const handler = keyPath ? functionBody(text, 'observeValue') : blockAfter(text, match.index + match[0].length)?.body;
    if (!handler) {
      found.push({ line: lineAt(text, match.index), redraws: false, guarded: false, handler: false });
      continue;
    }
    const reach = reachableText(text, handler);
    found.push({ line: lineAt(text, match.index), redraws: REDRAW.test(reach), guarded: MATCH.test(reach) && COMPARE_GUARD.test(reach), handler: true });
  }
  return found;
}

export function widgetFacts(source) {
  const text = stripComments(source);
  const intents = [...text.matchAll(/\b(?:struct|class)\s+(\w+)\s*:\s*[^{]*\bWidgetConfigurationIntent\b/g)].map((match) => {
    const block = blockAfter(text, match.index + match[0].length);
    return { name: match[1], line: lineAt(text, match.index), parameters: /@Parameter\b/.test(block?.body ?? '') };
  });
  const configurations = [...text.matchAll(/\b(StaticConfiguration|AppIntentConfiguration)\s*\(/g)].map((match) => {
    const args = text.slice(match.index, match.index + 400);
    const intent = /intent:\s*(\w+)\.self/.exec(args)?.[1] ?? null;
    const literal = /^\w+\s*\(\s*kind:\s*("(?:[^"\\\n]|\\.)*")/.exec(args)?.[1] ?? null;
    return { type: match[1], line: lineAt(text, match.index), intent, literalKind: literal };
  });
  return { intents, configurations };
}

export function scanSources(files, report, { configurable = false, label = (file) => file } = {}) {
  const intents = [];
  const configurations = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const observation of appearanceObservations(source)) {
      const where = `${label(file)}:${observation.line}`;
      if (!observation.handler) report.warn('MW-APPEAR-01', where, 'an effectiveAppearance observation whose handler this scan cannot find', 'a handler that redraws only when the light or dark match changes');
      else if (observation.redraws && !observation.guarded) report.error('MW-APPEAR-01', where, 'the effectiveAppearance handler redraws on every callback', 'compare bestMatch(from: [.darkAqua, .aqua]) with the last value and return early when it has not changed');
      else report.pass('MW-APPEAR-01', where, observation.redraws ? 'redraw behind a light or dark comparison' : 'no redraw reachable from the handler in this file', 'redraw only when the light or dark match changes');
    }
    const facts = widgetFacts(source);
    intents.push(...facts.intents.map((intent) => ({ ...intent, file })));
    configurations.push(...facts.configurations.map((configuration) => ({ ...configuration, file })));
  }
  const used = new Set(configurations.filter((item) => item.type === 'AppIntentConfiguration').map((item) => item.intent));
  const unused = intents.filter((intent) => !used.has(intent.name));
  const statics = configurations.filter((item) => item.type === 'StaticConfiguration');
  for (const item of statics) {
    const where = `${label(item.file)}:${item.line}`;
    if (unused.length) report.error('MW-CONFIG-01', where, `StaticConfiguration while ${unused.map((intent) => intent.name).join(', ')} is declared and no AppIntentConfiguration uses it; Edit Widget shows no options`, 'AppIntentConfiguration(kind:intent:provider:) with that intent, keeping the same kind string');
    else if (configurable) report.error('MW-CONFIG-01', where, 'StaticConfiguration for a widget that should offer options; Edit Widget shows none', 'AppIntentConfiguration with a WidgetConfigurationIntent whose parameters use AppEntity types, keeping the same kind string');
    else report.pass('MW-CONFIG-01', where, 'StaticConfiguration with no configuration requested', 'pass --configurable when the widget should offer options');
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

async function main() {
  const args = process.argv.slice(2);
  const configurable = args.includes('--configurable');
  const inputs = args.filter((arg) => arg !== '--configurable');
  if (!inputs.length || inputs.some((arg) => arg.startsWith('--'))) throw new UsageError('Usage: node scan-swift.mjs [--configurable] <file or folder> [...]');
  const files = listFiles(inputs);
  if (!files.length) throw new UsageError('No .swift file found.');
  const report = createReport({ tool: 'scan-swift', boundary: BOUNDARY });
  scanSources(files, report, { configurable, label: (file) => path.relative(process.cwd(), file) || file });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
