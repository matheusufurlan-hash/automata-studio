/**
 * Regras de AP e MT (puro, sem React): texto ⇄ regra para as janelas de regras
 * e as linhas do rótulo das setas. Notação do Hopcroft, uma regra por linha:
 *  - AP: `a, X/γ` — ex.: `0, Z/0Z`, `ε, Z/Z`, `1, 0/ε` (γ vazio = ε, só desempilha);
 *  - MT: `X/Y →` ou `X/Y ←` — ex.: `0/X →`, `B/B ←`.
 */
import { EPSILON } from '../../core/fa/types';
import type { PDARule } from '../../core/pda/types';
import type { TMMove, TMRule } from '../../core/tm/types';

export const ELLIPSIS = '…';
export const ARROW: Record<TMMove, string> = { L: '←', R: '→' };

/** "0, Z/0Z" */
export function formatPDARule(r: PDARule): string {
  return `${r.read}, ${r.pop}/${r.push === '' ? EPSILON : r.push}`;
}

/** "0/X →" */
export function formatTMRule(r: TMRule): string {
  return `${r.read}/${r.write} ${ARROW[r.move]}`;
}

/* ------------------------------------------------------------------ */
/* Rótulo das setas                                                    */
/* ------------------------------------------------------------------ */

/** eps = ε (cor própria); muted = separadores e "…"; move = seta da MT. */
export type PartTone = 'eps' | 'muted' | 'move';

export interface LabelPart {
  text: string;
  tone?: PartTone;
}

const eps = (s: string): LabelPart => (s === EPSILON || s === '' ? { text: EPSILON, tone: 'eps' } : { text: s });

export function pdaRuleParts(r: PDARule): LabelPart[] {
  return [eps(r.read), { text: ', ', tone: 'muted' }, { text: r.pop }, { text: '/', tone: 'muted' }, eps(r.push)];
}

export function tmRuleParts(r: TMRule): LabelPart[] {
  return [{ text: r.read }, { text: '/', tone: 'muted' }, { text: r.write }, { text: ' ' }, { text: ARROW[r.move], tone: 'move' }];
}

/** Rótulo com mais regras que isto vira compacto: as primeiras linhas e "… +N". */
export const MAX_RULE_LINES = 6;

export interface RuleLabel {
  /** Linhas que aparecem na seta (com mais de MAX_RULE_LINES regras, a última é "… +N"). */
  lines: LabelPart[][];
  /** Índice (em `rules`) da regra de cada linha; null na linha "… +N". */
  ruleOf: Array<number | null>;
  /** As linhas que aparecem, separadas por "\n" (serve para medir o rótulo). */
  text: string;
  /** Todas as regras, uma por linha (dica ao passar o mouse). */
  full: string;
  /** true = nem todas as regras aparecem. */
  compact: boolean;
}

export const lineText = (parts: readonly LabelPart[]) => parts.map((p) => p.text).join('');

export function ruleLabel<R>(rules: readonly R[], parts: (r: R) => LabelPart[]): RuleLabel {
  const all = rules.map(parts);
  const full = all.map(lineText).join('\n');
  if (all.length <= MAX_RULE_LINES) {
    return { lines: all, ruleOf: all.map((_, i) => i), text: full, full, compact: false };
  }
  const shown = MAX_RULE_LINES - 1;
  const lines = [...all.slice(0, shown), [{ text: `${ELLIPSIS} +${all.length - shown}`, tone: 'muted' as const }]];
  return {
    lines,
    ruleOf: [...all.slice(0, shown).map((_, i) => i), null],
    text: lines.map(lineText).join('\n'),
    full,
    compact: true,
  };
}

/* ------------------------------------------------------------------ */
/* Texto → regra (janelas de regras)                                   */
/* ------------------------------------------------------------------ */

export type RuleField = 'read' | 'pop' | 'push' | 'write' | 'move';

export interface FieldError {
  field: RuleField | null;
  message: string;
}

export interface LineError {
  /** 1 = primeira linha do texto. */
  line: number;
  message: string;
}

const chars = (s: string) => Array.from(s);
/** ϵ (outro epsilon do Unicode) vale como ε. */
const cleanEps = (s: string) => s.replace(/ϵ/g, EPSILON);
const oneChar = (s: string) => chars(s).length === 1 && !/\s/.test(s);

/** "Z0"/"Z₀" no lugar de Z: o símbolo do livro com índice. */
const looksLikeZ0 = (s: string) => /^Z[0₀]$/.test(s);

/**
 * Lê os campos de uma regra do AP. Em `a` e `γ`, vazio ou ε = ε.
 * Linha toda vazia → `{ rule: null, errors: [] }` (é ignorada).
 */
export function parsePDAFields(readIn: string, popIn: string, pushIn: string): { rule: PDARule | null; errors: FieldError[] } {
  const read = cleanEps(readIn.trim());
  const pop = cleanEps(popIn.trim());
  const push = cleanEps(pushIn.replace(/\s+/g, ''));
  if (!read && !pop && !push) return { rule: null, errors: [] };
  const errors: FieldError[] = [];
  if (read !== '' && read !== EPSILON && !oneChar(read)) {
    errors.push({ field: 'read', message: 'a entrada (a) precisa ser 1 símbolo ou ε' });
  }
  if (pop === EPSILON) {
    errors.push({ field: 'pop', message: 'o topo da pilha (X) não pode ser ε: toda regra desempilha 1 símbolo' });
  } else if (!oneChar(pop)) {
    errors.push({
      field: 'pop',
      message:
        'o topo da pilha (X) precisa ser exatamente 1 símbolo' + (looksLikeZ0(pop) ? ' (o Z0 do livro aqui é só Z)' : ''),
    });
  }
  if (push !== EPSILON && push.includes(EPSILON)) {
    errors.push({ field: 'push', message: 'em γ, use ε sozinho (para não empilhar nada) ou só símbolos' });
  }
  if (errors.length) return { rule: null, errors };
  return { rule: { read: read === '' ? EPSILON : read, pop, push: push === EPSILON ? '' : push }, errors };
}

/** Várias regras do AP, uma por linha: "0, Z / 0Z". Linhas vazias são ignoradas. */
export function parsePDAText(text: string): { rules: PDARule[]; errors: LineError[] } {
  const rules: PDARule[] = [];
  const errors: LineError[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const comma = line.indexOf(',');
    const slash = comma < 0 ? -1 : line.indexOf('/', comma + 1);
    if (comma < 0 || slash < 0) {
      errors.push({ line: i + 1, message: 'use o formato a, X/γ (ex.: 0, Z/0Z)' });
      return;
    }
    const r = parsePDAFields(line.slice(0, comma), line.slice(comma + 1, slash), line.slice(slash + 1));
    if (r.rule) rules.push(r.rule);
    for (const e of r.errors) errors.push({ line: i + 1, message: e.message });
  });
  return { rules, errors };
}

/** Lê os campos de uma regra da MT. Linha toda vazia → `{ rule: null, errors: [] }`. */
export function parseTMFields(readIn: string, writeIn: string, move: TMMove): { rule: TMRule | null; errors: FieldError[] } {
  const read = cleanEps(readIn.trim());
  const write = cleanEps(writeIn.trim());
  if (!read && !write) return { rule: null, errors: [] };
  const errors: FieldError[] = [];
  const check = (s: string, field: RuleField, what: string) => {
    if (s === EPSILON) errors.push({ field, message: `${what} não pode ser ε: na MT, a célula vazia é o branco` });
    else if (!oneChar(s)) errors.push({ field, message: `${what} precisa ser exatamente 1 símbolo` });
  };
  check(read, 'read', 'o símbolo lido (X)');
  check(write, 'write', 'o símbolo escrito (Y)');
  if (errors.length) return { rule: null, errors };
  return { rule: { read, write, move }, errors };
}

const MOVES: Record<string, TMMove> = {
  r: 'R',
  '→': 'R',
  '>': 'R',
  d: 'R',
  l: 'L',
  '←': 'L',
  '<': 'L',
  e: 'L',
};

/** Direção escrita pelo usuário: R, →, > ou D (direita); L, ←, < ou E (esquerda). */
export function parseMove(s: string): TMMove | null {
  return MOVES[s.trim().toLowerCase()] ?? null;
}

/** Várias regras da MT, uma por linha: "0/X R", "0/X →" ou "0 / X, R". */
export function parseTMText(text: string): { rules: TMRule[]; errors: LineError[] } {
  const rules: TMRule[] = [];
  const errors: LineError[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^(\S+?)\s*\/\s*(\S+?)\s*[,;]?\s*(\S+)$/.exec(line);
    if (!m) {
      errors.push({ line: i + 1, message: 'use o formato X/Y → (ex.: 0/X → ou 0/X R)' });
      return;
    }
    const move = parseMove(m[3]!);
    if (!move) {
      errors.push({ line: i + 1, message: 'a direção precisa ser → (R) ou ← (L)' });
      return;
    }
    const r = parseTMFields(m[1]!, m[2]!, move);
    if (r.rule) rules.push(r.rule);
    for (const e of r.errors) errors.push({ line: i + 1, message: e.message });
  });
  return { rules, errors };
}
