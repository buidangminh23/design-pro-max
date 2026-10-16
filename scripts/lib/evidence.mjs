/**
 * The proof contract for own parts: the evidence ledger (evidence/ledger.json), the rule registry (rules.json), the
 * fixture cases (fixtures/<part>/cases.json) and the lints that tie a part's text to them. Vendored parts stay outside
 * all of this.
 *
 * Citation lint: an id in a part's text must be a ledger entry or a rule. Numeric lint: in prose (fenced code and
 * inline code spans are skipped, since they hold syntax), a number with a unit needs a citation on its line, and every such number on a line that cites ids must
 * appear in a cited entry's value or correction, or in a cited rule's values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR } from './vendor.mjs';

export const LEDGER_FILE = 'evidence/ledger.json';
export const RULES_FILE = 'rules.json';
export const OWN_PARTS = ['launch-scroll'];
export const LABELS = ['measured', 'documented', 'inferred', 'policy'];
export const ENTRY_KEYS = ['claim', 'value', 'label', 'date', 'source', 'method', 'confidence', 'remeasure', 'status', 'correction', 'sourceSha'];
export const RULE_KEYS = ['id', 'part', 'level', 'statement', 'values', 'evidence', 'check', 'fixtures', 'implementedBy'];

export const LEDGER_ID = /\b(?:AM|AD|ON|TQ|PV|SC|EC)-N?\d+\b|\bPOL-\d+\b/g;
export const RULE_ID = /\b(?:LS|LV|LP)-[A-Z]+-(?:\d{2}|[A-Z]+)\b|\b(?:LS|LV|LP)-WARN-[A-Z0-9]+\b/g;
const UNIT_NUMBER = /(?<![\w.-])(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s?(ms|s|vh|lvh|svh|dvh|px|fps|Hz|%|KB|MB|GB|MiB|GiB|frames?|times|bytes?)(?![\w])/g;
const LOCAL_PATH = /[A-Za-z]:[\\/]|\/(?:Users|Volumes|private|home|tmp)\/|\bresearch\/|scratchpad/;

const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'));

export function loadLedger(root) {
  return readJson(root, LEDGER_FILE);
}

export function loadRules(root) {
  return readJson(root, RULES_FILE).rules;
}

export function loadCases(root, part) {
  const file = path.join(root, 'fixtures', part, 'cases.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).cases : [];
}

export function ledgerProblems(ledger) {
  const problems = [];
  for (const [id, entry] of Object.entries(ledger.entries ?? {})) {
    if (!new RegExp(`^(?:${LEDGER_ID.source})$`).test(id)) problems.push(`${id}: not a ledger id`);
    const keys = Object.keys(entry);
    for (const key of ENTRY_KEYS) if (!keys.includes(key)) problems.push(`${id}: missing ${key}`);
    for (const key of keys) if (!ENTRY_KEYS.includes(key)) problems.push(`${id}: unknown field ${key}`);
    if (!LABELS.includes(entry.label)) problems.push(`${id}: label ${entry.label} is not one of ${LABELS.join(', ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '')) problems.push(`${id}: date must be YYYY-MM-DD`);
    if (entry.source !== 'local benchmark' && !/^https:\/\/[^\s]+$/.test(entry.source ?? '')) problems.push(`${id}: source must be an https URL or "local benchmark"`);
    if (!/^[0-9a-f]{64}$/.test(entry.sourceSha ?? '')) problems.push(`${id}: sourceSha must be a SHA-256 (run scripts/import-findings.mjs --write)`);
    for (const key of ['claim', 'value', 'method', 'remeasure', 'correction']) {
      if (entry[key] !== null && typeof entry[key] !== 'string') problems.push(`${id}: ${key} must be text`);
      if (typeof entry[key] === 'string' && LOCAL_PATH.test(entry[key])) problems.push(`${id}: ${key} names a local path`);
    }
    if (entry.status === 'corrected' && !entry.correction) problems.push(`${id}: a corrected entry needs its correction`);
  }
  return problems;
}

export function rulesProblems(root, rules, ledger) {
  const problems = [];
  const seen = new Set();
  const entries = ledger.entries ?? {};
  for (const rule of rules) {
    const id = rule.id ?? '(no id)';
    for (const key of RULE_KEYS) if (!(key in rule)) problems.push(`${id}: missing ${key}`);
    if (seen.has(id)) problems.push(`${id}: duplicate id`);
    seen.add(id);
    if (!OWN_PARTS.includes(rule.part)) problems.push(`${id}: unknown part ${rule.part}`);
    if (!['error', 'warn'].includes(rule.level)) problems.push(`${id}: level must be error or warn`);
    if (!rule.evidence?.length) problems.push(`${id}: needs evidence`);
    for (const ref of rule.evidence ?? []) if (!entries[ref]) problems.push(`${id}: evidence ${ref} is not in ${LEDGER_FILE}`);
    const sourced = (rule.evidence ?? []).some((ref) => entries[ref] && entries[ref].label !== 'inferred');
    for (const file of [rule.check, ...(rule.implementedBy ?? [])].filter(Boolean)) {
      if (!fs.existsSync(path.join(root, SKILL_DIR, ...file.split('/')))) problems.push(`${id}: ${file} does not exist under ${SKILL_DIR}`);
    }
    if (rule.level !== 'error') continue;
    if (!sourced) problems.push(`${id}: an error rule needs evidence that is not inferred`);
    if (!rule.check) problems.push(`${id}: an error rule needs a check`);
    const cases = loadCases(root, rule.part);
    for (const kind of ['pass', 'fail']) {
      const names = rule.fixtures?.[kind] ?? [];
      if (!names.length) problems.push(`${id}: an error rule needs a ${kind} fixture`);
      for (const name of names) {
        const entry = cases.find((candidate) => candidate.id === name);
        const rulesOf = entry ? (Array.isArray(entry.rule) ? entry.rule : [entry.rule]) : [];
        if (!entry) problems.push(`${id}: fixture ${name} is not in fixtures/${rule.part}/cases.json`);
        else if (entry.expect !== kind || !rulesOf.includes(id)) problems.push(`${id}: fixture ${name} is not a ${kind} case for this rule`);
      }
    }
  }
  return problems;
}

/** Lines of prose: fenced code blocks and HTML comments are left out, line numbers kept. */
export function proseLines(text) {
  const lines = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (!fenced) lines.push({ number: index + 1, text: line.replace(/<!--.*?-->/g, '') });
  });
  return lines;
}

export function citationProblems(text, file, ledger, rules) {
  const problems = [];
  const entries = ledger.entries ?? {};
  const byRule = new Map(rules.map((rule) => [rule.id, rule]));
  for (const { number, text: line } of proseLines(text)) {
    const ledgerIds = [...new Set(line.match(LEDGER_ID) ?? [])];
    const ruleIds = [...new Set(line.match(RULE_ID) ?? [])];
    for (const id of ledgerIds) if (!entries[id]) problems.push(`${file}:${number}: ${id} is not in ${LEDGER_FILE}`);
    for (const id of ruleIds) if (!byRule.has(id)) problems.push(`${file}:${number}: ${id} is not in ${RULES_FILE}`);
    const stripped = line.replace(/`[^`]*`/g, ' ').replace(LEDGER_ID, ' ').replace(RULE_ID, ' ');
    const numbers = [...stripped.matchAll(UNIT_NUMBER)];
    if (!numbers.length) continue;
    if (!ledgerIds.length && !ruleIds.length) {
      problems.push(`${file}:${number}: "${numbers[0][0]}" needs a citation (a ledger id or a rule id) on its line`);
      continue;
    }
    const sources = [
      ...ledgerIds.flatMap((id) => [entries[id]?.value, entries[id]?.correction]),
      ...ruleIds.flatMap((id) => [byRule.get(id)?.values, byRule.get(id)?.statement]),
    ].filter(Boolean).join(' ');
    const known = new Set(sources.match(/\d+(?:\.\d+)?/g) ?? []);
    for (const match of numbers) {
      for (const value of [match[1], match[2]].filter(Boolean)) {
        if (!known.has(value)) problems.push(`${file}:${number}: ${value} beside ${[...ledgerIds, ...ruleIds].join(', ')} is in none of their values`);
      }
    }
  }
  return problems;
}

/** The text files of an own part that the lints read: PART.md and the hand-written references. */
export function partTextFiles(root, part) {
  const folder = path.join(root, SKILL_DIR, part);
  const files = ['PART.md'];
  const references = path.join(folder, 'references');
  if (fs.existsSync(references)) {
    for (const name of fs.readdirSync(references).sort()) if (name.endsWith('.md') && name !== 'evidence.md') files.push(`references/${name}`);
  }
  return files.filter((file) => fs.existsSync(path.join(folder, file))).map((file) => `${SKILL_DIR}/${part}/${file}`);
}

/** The ledger ids an own part cites in its text, sorted. */
export function citedIds(root, part, ledger) {
  const ids = new Set();
  for (const file of partTextFiles(root, part)) {
    for (const id of fs.readFileSync(path.join(root, ...file.split('/')), 'utf8').match(LEDGER_ID) ?? []) if (ledger.entries?.[id]) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/** references/evidence.md of a part: its rules and every ledger entry it or its rules cite. */
export function buildEvidence(root, part, ledger, rules) {
  const own = rules.filter((rule) => rule.part === part);
  const ids = new Set([...citedIds(root, part, ledger), ...own.flatMap((rule) => rule.evidence)]);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const lines = [
    `# ${part} evidence`,
    '',
    'Generated by scripts/gen.mjs from rules.json and evidence/ledger.json; do not edit by hand. Error rules have a check and fixtures that the check was seen to fail; warn rules guide without blocking. Claims are paraphrased; values are ranges or principles.',
    '',
    '## Rules',
    '',
    '| Rule | Level | Statement | Evidence |',
    '|---|---|---|---|',
    ...own.map((rule) => `| ${rule.id} | ${rule.level} | ${cell(rule.statement)} | ${rule.evidence.join(', ')} |`),
    '',
    '## Claims',
    '',
    '| Id | Claim | Value | Label | Source | Date |',
    '|---|---|---|---|---|---|',
    ...sorted.map((id) => {
      const entry = ledger.entries[id];
      const value = entry.correction ? `${entry.value} (corrected: ${entry.correction})` : entry.value;
      return `| ${id} | ${cell(entry.claim)} | ${cell(value)} | ${entry.label} | ${entry.source} | ${entry.date} |`;
    }),
    '',
  ];
  return lines.join('\n');
}
