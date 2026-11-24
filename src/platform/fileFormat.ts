/**
 * Leitura e escrita do formato `.automato.json` (puro: sem DOM).
 *
 * Três tipos (rodada 2): AF (`kind: 'fa'`), AP (`kind: 'pda'`) e MT
 * (`kind: 'tm'`). Os arquivos de AF da rodada 1 continuam valendo sem mudança.
 * As mensagens de erro são para o usuário final, em português simples.
 */
import type { AnyAutomatonFile, Automaton } from '../core/automaton';
import type { AutomatonState, GraphLike } from '../core/common';
import type { EdgeLayout, FA, FATransition, Layout, Point } from '../core/fa/types';
import { DEFAULT_START_STACK_SYMBOL } from '../core/pda/types';
import type { PDA, PDAAcceptance, PDARule, PDATransition } from '../core/pda/types';
import { DEFAULT_BLANK } from '../core/tm/types';
import type { TM, TMAcceptance, TMRule, TMTransition } from '../core/tm/types';

export const FILE_EXTENSION = '.automato.json';

export class FileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileFormatError';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type Broken = (detail: string) => never;

const BROKEN_PREFIX = {
  fa: 'O autômato do arquivo está incompleto ou corrompido',
  pda: 'O autômato com pilha do arquivo está incompleto ou corrompido',
  tm: 'A máquina de Turing do arquivo está incompleta ou corrompida',
} as const;

function brokenFor(kind: keyof typeof BROKEN_PREFIX): Broken {
  return (detail) => {
    throw new FileFormatError(`${BROKEN_PREFIX[kind]} (${detail}).`);
  };
}

/** Lê o texto de um arquivo e valida. Lança FileFormatError com mensagem amigável. */
export function parseAutomatonFile(text: string, fallbackName = 'Sem título'): AnyAutomatonFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FileFormatError('O arquivo não é um JSON válido. Ele pode estar corrompido.');
  }
  if (!isObj(data) || data.format !== 'automatos-studio') {
    throw new FileFormatError('Este arquivo não é do Automata Studio.');
  }
  if (data.version !== 1) {
    throw new FileFormatError(
      `Este arquivo usa a versão ${String(data.version)} do formato, que esta versão do programa não conhece.`,
    );
  }
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fallbackName;
  const format = 'automatos-studio';
  switch (data.kind) {
    case 'fa': {
      const fa = parseFA(data.fa);
      return { format, version: 1, kind: 'fa', name, fa, layout: parseLayout(data.layout, fa) };
    }
    case 'pda': {
      const pda = parsePDA(data.pda);
      return { format, version: 1, kind: 'pda', name, pda, layout: parseLayout(data.layout, pda) };
    }
    case 'tm': {
      const tm = parseTM(data.tm);
      return { format, version: 1, kind: 'tm', name, tm, layout: parseLayout(data.layout, tm) };
    }
    default:
      throw new FileFormatError('Este arquivo tem um tipo de autômato que esta versão do programa não conhece.');
  }
}

/* ---------- partes comuns ---------- */

function parseStates(raw: unknown[], broken: Broken): AutomatonState[] {
  const ids = new Set<string>();
  return raw.map((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || !s.id) broken(`estado nº ${i + 1} sem id`);
    if (ids.has(s.id)) broken(`estado "${s.id}" repetido`);
    ids.add(s.id);
    return {
      id: s.id,
      name: typeof s.name === 'string' && s.name ? s.name : s.id,
      initial: s.initial === true,
      final: s.final === true,
    };
  });
}

/** Lê as transições; `content` lê o que é próprio do tipo (símbolos ou regras). */
function parseTransitions<T>(
  raw: unknown[],
  states: AutomatonState[],
  broken: Broken,
  content: (t: Record<string, unknown>, id: string) => T,
): Array<{ id: string; from: string; to: string } & T> {
  const ids = new Set(states.map((s) => s.id));
  const tids = new Set<string>();
  return raw.map((t, i) => {
    if (!isObj(t) || typeof t.id !== 'string' || !t.id) broken(`transição nº ${i + 1} sem id`);
    if (tids.has(t.id)) broken(`transição "${t.id}" repetida`);
    tids.add(t.id);
    if (typeof t.from !== 'string' || !ids.has(t.from) || typeof t.to !== 'string' || !ids.has(t.to)) {
      broken(`a transição "${t.id}" liga um estado que não existe`);
    }
    return { id: t.id, from: t.from, to: t.to, ...content(t, t.id) };
  });
}

function graphParts(raw: unknown, broken: Broken): { obj: Record<string, unknown>; states: unknown[]; transitions: unknown[] } {
  if (!isObj(raw) || !Array.isArray(raw.states) || !Array.isArray(raw.transitions)) broken('faltam estados ou transições');
  return { obj: raw, states: raw.states, transitions: raw.transitions };
}

/** Lista de regras sem repetição (a ordem é mantida: ela importa na simulação). */
function uniqueRules<R>(rules: R[], key: (r: R) => string): R[] {
  const seen = new Set<string>();
  return rules.filter((r) => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ---------- AF ---------- */

function parseFA(raw: unknown): FA {
  const broken: Broken = brokenFor('fa');
  const g = graphParts(raw, broken);
  const states = parseStates(g.states, broken);
  const transitions: FATransition[] = parseTransitions(g.transitions, states, broken, (t, id) => {
    if (!Array.isArray(t.symbols) || !t.symbols.every((x) => typeof x === 'string')) {
      broken(`símbolos inválidos na transição "${id}"`);
    }
    return { symbols: [...new Set(t.symbols as string[])] };
  });
  return { states, transitions };
}

/* ---------- AP ---------- */

function parsePDA(raw: unknown): PDA {
  const broken: Broken = brokenFor('pda');
  const g = graphParts(raw, broken);
  const states = parseStates(g.states, broken);
  const transitions: PDATransition[] = parseTransitions(g.transitions, states, broken, (t, id) => {
    if (!Array.isArray(t.rules)) broken(`a transição "${id}" não tem a lista de regras`);
    const rules = t.rules.map((r, i): PDARule => {
      if (!isObj(r) || typeof r.read !== 'string' || typeof r.pop !== 'string' || typeof r.push !== 'string') {
        broken(`regra nº ${i + 1} da transição "${id}" inválida`);
      }
      return { read: r.read, pop: r.pop, push: r.push };
    });
    return { rules: uniqueRules(rules, (r) => `${r.read}\u0000${r.pop}\u0000${r.push}`) };
  });
  const z0 = g.obj.startStackSymbol;
  if (z0 !== undefined && typeof z0 !== 'string') broken('símbolo inicial da pilha (Z0) inválido');
  const acc = g.obj.acceptance;
  if (acc !== undefined && acc !== 'FINAL_STATE' && acc !== 'EMPTY_STACK') broken('modo de aceitação desconhecido');
  return {
    states,
    transitions,
    startStackSymbol: z0 ?? DEFAULT_START_STACK_SYMBOL,
    acceptance: (acc as PDAAcceptance | undefined) ?? 'FINAL_STATE',
  };
}

/* ---------- MT ---------- */

function parseTM(raw: unknown): TM {
  const broken: Broken = brokenFor('tm');
  const g = graphParts(raw, broken);
  const states = parseStates(g.states, broken);
  const transitions: TMTransition[] = parseTransitions(g.transitions, states, broken, (t, id) => {
    if (!Array.isArray(t.rules)) broken(`a transição "${id}" não tem a lista de regras`);
    const rules = t.rules.map((r, i): TMRule => {
      if (!isObj(r) || typeof r.read !== 'string' || typeof r.write !== 'string') {
        broken(`regra nº ${i + 1} da transição "${id}" inválida`);
      }
      if (r.move !== 'L' && r.move !== 'R') broken(`direção inválida na regra nº ${i + 1} da transição "${id}" (use L ou R)`);
      return { read: r.read, write: r.write, move: r.move };
    });
    return { rules: uniqueRules(rules, (r) => `${r.read}\u0000${r.write}\u0000${r.move}`) };
  });
  const blank = g.obj.blank;
  if (blank !== undefined && typeof blank !== 'string') broken('símbolo branco inválido');
  const acc = g.obj.acceptance;
  if (acc !== undefined && acc !== 'FINAL_STATE' && acc !== 'HALT') broken('modo de aceitação desconhecido');
  const sigma = g.obj.inputAlphabet;
  if (sigma !== undefined && (!Array.isArray(sigma) || !sigma.every((x) => typeof x === 'string'))) {
    broken('alfabeto de entrada (Σ) inválido');
  }
  return {
    states,
    transitions,
    blank: blank ?? DEFAULT_BLANK,
    acceptance: (acc as TMAcceptance | undefined) ?? 'FINAL_STATE',
    inputAlphabet: [...new Set((sigma as string[] | undefined) ?? [])],
  };
}

/* ---------- desenho ---------- */

/** Layout é tolerante: posições que faltarem são completadas depois pelo autoLayout. */
function parseLayout(raw: unknown, g: GraphLike): Layout {
  const positions: Record<string, Point> = {};
  const edges: Record<string, EdgeLayout> = {};
  if (!isObj(raw)) return { positions, edges };
  const rp = isObj(raw.positions) ? raw.positions : {};
  for (const s of g.states) {
    const p = rp[s.id];
    if (isObj(p) && isNum(p.x) && isNum(p.y)) positions[s.id] = { x: p.x, y: p.y };
  }
  const re = isObj(raw.edges) ? raw.edges : {};
  for (const t of g.transitions) {
    const e = re[t.id];
    if (!isObj(e)) continue;
    const edge: EdgeLayout = { curvature: isNum(e.curvature) ? e.curvature : 0 };
    if (isNum(e.loopAngle)) edge.loopAngle = e.loopAngle;
    edges[t.id] = edge;
  }
  return { positions, edges };
}

/* ---------- arquivo ⇄ autômato ---------- */

/** O autômato guardado no arquivo (com o `kind`). */
export function automatonOf(file: AnyAutomatonFile): Automaton {
  switch (file.kind) {
    case 'fa':
      return { kind: 'fa', fa: file.fa };
    case 'pda':
      return { kind: 'pda', pda: file.pda };
    case 'tm':
      return { kind: 'tm', tm: file.tm };
  }
}

/** Monta o arquivo de um autômato de qualquer tipo. */
export function fileOf(name: string, automaton: Automaton, layout: Layout): AnyAutomatonFile {
  const format = 'automatos-studio';
  switch (automaton.kind) {
    case 'fa':
      return { format, version: 1, kind: 'fa', name, fa: automaton.fa, layout };
    case 'pda':
      return { format, version: 1, kind: 'pda', name, pda: automaton.pda, layout };
    case 'tm':
      return { format, version: 1, kind: 'tm', name, tm: automaton.tm, layout };
  }
}

export function serializeAutomatonFile(file: AnyAutomatonFile): string {
  return JSON.stringify(file, null, 2) + '\n';
}

const FORBIDDEN = '\\/:*?"<>|';

/** Nome de arquivo seguro: tira caracteres proibidos e põe a extensão. */
export function fileNameFor(name: string, extension = FILE_EXTENSION): string {
  const base =
    [...name.replace(/\.automato\.json$/i, '')]
      .filter((ch) => ch.charCodeAt(0) >= 32 && !FORBIDDEN.includes(ch))
      .join('')
      .trim() || 'automato';
  return base + extension;
}

/** "termina em 01.automato.json" → "termina em 01". */
export function baseName(fileName: string): string {
  return fileName.replace(/\.automato\.json$/i, '').replace(/\.json$/i, '');
}
