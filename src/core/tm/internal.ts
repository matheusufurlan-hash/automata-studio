/**
 * Peças internas do núcleo de MT (não fazem parte da API pública).
 *
 * Tudo aqui é puro: nada modifica a TM recebida.
 */
import { EPSILON } from '../common';
import { compareNames, compareSymbols } from '../fa/internal';
import { DEFAULT_BLANK } from './types';
import type { RuleRef, StateId, Sym, TM, TMConfig, TMMove, TMRule, TMState } from './types';

export { compareNames, compareSymbols };

/* ------------------------------------------------------------------ */
/* Símbolos                                                            */
/* ------------------------------------------------------------------ */

/** Símbolo de fita: exatamente 1 caractere (code point) e diferente de ε. */
export function isTapeSymbol(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length <= 2 && Array.from(s).length === 1 && s !== EPSILON;
}

export function isValidMove(m: unknown): m is TMMove {
  return m === 'L' || m === 'R';
}

export function isValidRule(r: TMRule): boolean {
  return isTapeSymbol(r.read) && isTapeSymbol(r.write) && isValidMove(r.move);
}

/** O branco que a simulação usa: o da TM, ou DEFAULT_BLANK se ele for inválido (validate avisa). */
export function blankOf(tm: TM): Sym {
  return isTapeSymbol(tm.blank) ? tm.blank : DEFAULT_BLANK;
}

/** Ordem de Γ: alfabética, com o branco por último. */
export function sortTapeSymbols(symbols: Iterable<Sym>, blank: Sym): Sym[] {
  return [...new Set(symbols)].sort((a, b) => {
    if (a === b) return 0;
    if (a === blank) return 1;
    if (b === blank) return -1;
    return compareSymbols(a, b);
  });
}

/* ------------------------------------------------------------------ */
/* Grafo: a visão da TM que os algoritmos usam                         */
/* ------------------------------------------------------------------ */

/** Um movimento possível: uma regra válida de uma transição não pendurada. */
export interface Move {
  via: RuleRef;
  to: StateId;
  write: Sym;
  move: TMMove;
}

/**
 * A TM "limpa": ignora transições penduradas, regras inválidas, regras
 * repetidas (vale a primeira) e ids de estado repetidos (vale o primeiro).
 */
export interface Graph {
  /** Ids dos estados, na ordem da TM. */
  ids: StateId[];
  byId: Map<StateId, TMState>;
  /** Primeiro estado inicial (na ordem de `states`), ou null. */
  initial: StateId | null;
  finals: Set<StateId>;
  /** δ: estado → símbolo lido → movimentos, na ordem das transições e das regras. */
  moves: Map<StateId, Map<Sym, Move[]>>;
  blank: Sym;
  /** Σ (o informado e válido, ou o palpite Γ − {B}), em ordem. */
  sigma: Sym[];
  /** true = Σ não foi informado (ou nenhum símbolo informado é válido). */
  sigmaGuessed: boolean;
  /** Γ (lidos, escritos, B e Σ informado), em ordem com B por último. */
  gamma: Sym[];
}

export function buildGraph(tm: TM): Graph {
  const ids: StateId[] = [];
  const byId = new Map<StateId, TMState>();
  for (const s of tm.states) {
    if (byId.has(s.id)) continue;
    byId.set(s.id, s);
    ids.push(s.id);
  }
  const initial = ids.find((id) => byId.get(id)!.initial) ?? null;
  const finals = new Set(ids.filter((id) => byId.get(id)!.final));
  const blank = blankOf(tm);

  const moves = new Map<StateId, Map<Sym, Move[]>>();
  for (const id of ids) moves.set(id, new Map());
  const seen = new Set<string>();
  const used = new Set<Sym>();
  for (const t of tm.transitions) {
    if (!byId.has(t.from) || !byId.has(t.to)) continue;
    const bySymbol = moves.get(t.from)!;
    t.rules.forEach((r, rule) => {
      if (!isValidRule(r)) return;
      const key = JSON.stringify([t.from, r.read, t.to, r.write, r.move]);
      if (seen.has(key)) return;
      seen.add(key);
      let list = bySymbol.get(r.read);
      if (!list) {
        list = [];
        bySymbol.set(r.read, list);
      }
      list.push({ via: { transition: t.id, rule }, to: t.to, write: r.write, move: r.move });
      used.add(r.read);
      used.add(r.write);
    });
  }

  const informed = (Array.isArray(tm.inputAlphabet) ? tm.inputAlphabet : []).filter(
    (s) => isTapeSymbol(s) && s !== blank,
  );
  const sigmaGuessed = informed.length === 0;
  const sigma = sortTapeSymbols(sigmaGuessed ? [...used].filter((s) => s !== blank) : informed, blank);
  const gamma = sortTapeSymbols([...used, blank, ...informed], blank);
  return { ids, byId, initial, finals, moves, blank, sigma, sigmaGuessed, gamma };
}

/** Movimentos de (q, X), na ordem das transições e das regras. */
export function movesOf(g: Graph, state: StateId, symbol: Sym): Move[] {
  return g.moves.get(state)?.get(symbol) ?? [];
}

/** NTM se algum (q, X) tem mais de um movimento diferente. */
export function isDeterministic(g: Graph): boolean {
  for (const bySymbol of g.moves.values()) {
    for (const list of bySymbol.values()) if (list.length > 1) return false;
  }
  return true;
}

/** Ordena ids de estados pelo nome (ordem natural); empate pelo id. */
export function sortIdsByName(g: Graph, ids: Iterable<StateId>): StateId[] {
  return [...ids].sort((a, b) => {
    const c = compareNames(g.byId.get(a)?.name ?? a, g.byId.get(b)?.name ?? b);
    return c !== 0 ? c : compareSymbols(a, b);
  });
}

/* ------------------------------------------------------------------ */
/* Fita                                                                */
/* ------------------------------------------------------------------ */

/**
 * Fita infinita para os dois lados. Guarda só o trecho onde já se escreveu
 * algo não branco, e os limites [lo, hi] das células não brancas, para que
 * cada passo custe só o tamanho do trecho que vai para a configuração (uma
 * MT que anda sobre brancos para sempre não faz a fita crescer).
 */
export class Tape {
  private cells: Sym[];
  private readonly blank: Sym;
  /** Posição absoluta de cells[0]. */
  private offset = 0;
  /** Índices (em `cells`) da 1ª e da última célula não branca; lo > hi = fita toda branca. */
  private lo: number;
  private hi: number;

  /** A entrada começa na célula 0, que é onde a cabeça começa. */
  constructor(input: Sym[], blank: Sym) {
    this.cells = [...input];
    this.blank = blank;
    this.lo = this.cells.findIndex((c) => c !== blank);
    if (this.lo < 0) {
      this.lo = 0;
      this.hi = -1;
    } else {
      this.hi = this.cells.length - 1;
      while (this.cells[this.hi] === blank) this.hi--;
    }
  }

  get(pos: number): Sym {
    return this.cells[pos - this.offset] ?? this.blank;
  }

  set(pos: number, sym: Sym): void {
    let i = pos - this.offset;
    if (sym === this.blank) {
      if (i < 0 || i >= this.cells.length || this.cells[i] === this.blank) return;
      this.cells[i] = sym;
      if (i === this.lo) while (this.lo <= this.hi && this.cells[this.lo] === this.blank) this.lo++;
      if (i === this.hi) while (this.hi >= this.lo && this.cells[this.hi] === this.blank) this.hi--;
      return;
    }
    if (i < 0) {
      // cresce para a esquerda em blocos (unshift a cada passo seria quadrático)
      const extra = Math.max(-i, this.cells.length, 16);
      this.cells = [...Array<Sym>(extra).fill(this.blank), ...this.cells];
      this.offset -= extra;
      this.lo += extra;
      this.hi += extra;
      i += extra;
    }
    while (i >= this.cells.length) this.cells.push(this.blank);
    this.cells[i] = sym;
    if (this.lo > this.hi) {
      this.lo = i;
      this.hi = i;
    } else {
      if (i < this.lo) this.lo = i;
      if (i > this.hi) this.hi = i;
    }
  }

  /** Configuração com o MENOR trecho que tem todas as células não brancas e a da cabeça. */
  config(state: StateId, head: number): TMConfig {
    let from = head;
    let to = head;
    if (this.lo <= this.hi) {
      from = Math.min(head, this.lo + this.offset);
      to = Math.max(head, this.hi + this.offset);
    }
    // trecho [from, to] em posições absolutas; fora de `cells` é branco
    const a = from - this.offset;
    const b = to - this.offset;
    const n = this.cells.length;
    const before = a < 0 ? this.blank.repeat(Math.min(-a, b - a + 1)) : '';
    const after = b >= n ? this.blank.repeat(Math.min(b - n + 1, b - a + 1)) : '';
    const tape = before + this.cells.slice(Math.max(a, 0), Math.min(b + 1, n)).join('') + after;
    return { state, tape, head: head - from, origin: from };
  }
}

/** Conteúdo da fita sem os brancos das pontas ('' = fita toda branca). */
export function tapeOutput(config: TMConfig, blank: Sym): string {
  const cells = Array.from(config.tape);
  let lo = 0;
  while (lo < cells.length && cells[lo] === blank) lo++;
  let hi = cells.length - 1;
  while (hi >= lo && cells[hi] === blank) hi--;
  return cells.slice(lo, hi + 1).join('');
}
