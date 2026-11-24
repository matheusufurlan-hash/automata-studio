/**
 * Documentos abertos (abas) + Desfazer/Refazer por documento.
 *
 * API PÚBLICA: a simulação e as ferramentas usam estes nomes. Não renomeie.
 *
 * Cada documento guarda um `Automaton` — AF (`fa`), AP (`pda`) ou MT (`tm`) —
 * e o desenho (`layout`). O modelo é só dados imutáveis, então o histórico
 * guarda snapshots `{ automaton, layout }` (até HISTORY_LIMIT por documento).
 * As ações de edição agem sempre sobre o documento ATIVO e cada uma vira UMA
 * entrada no histórico.
 *
 *  - ações genéricas (criar/apagar/renomear estado, inicial, final, mover,
 *    curvatura, organizar): valem para os três tipos;
 *  - `setTransition` / `setTransitionSymbols`: só AF (em AP/MT não fazem nada);
 *  - `setRules` / `setTransitionRules`: só AP e MT, com regras do tipo da aba
 *    (regras de outro tipo são ignoradas);
 *  - `setPDAOptions` / `setTMOptions`: propriedades do AP (Z0, aceitação) e da
 *    MT (branco, aceitação, Σ).
 *
 * Para ler o autômato da aba: `doc.automaton` (com `kind`), ou os atalhos
 * `faOf(doc)`, `pdaOf(doc)`, `tmOf(doc)` (null se a aba for de outro tipo) e
 * `graphOf(doc.automaton)` (só estados e setas, de qualquer tipo).
 */
import { create } from 'zustand';
import { graphOf } from '../core/automaton';
import type { AnyAutomatonFile, Automaton, AutomatonKind } from '../core/automaton';
import type { AutomatonState, GraphLike } from '../core/common';
import { EPSILON } from '../core/fa/types';
import type { EdgeLayout, FA, FATransition, Layout, Point, StateId, Sym, TransitionId } from '../core/fa/types';
import { DEFAULT_START_STACK_SYMBOL } from '../core/pda/types';
import type { PDA, PDAAcceptance, PDARule, PDATransition } from '../core/pda/types';
import { DEFAULT_BLANK } from '../core/tm/types';
import type { TM, TMAcceptance, TMRule, TMTransition } from '../core/tm/types';
import { bestLoopAngle, curvatureAvoiding, ensureLayout } from '../layout/autoLayout';
import { automatonOf, fileOf } from '../platform/fileFormat';
import { useHighlight } from './highlight';

export interface Doc {
  id: string;
  name: string;
  /** O autômato da aba: AF, AP ou MT. */
  automaton: Automaton;
  layout: Layout;
  /** true = há alterações que não foram salvas. */
  dirty: boolean;
}

/** Propriedades do AP que o usuário escolhe (painel "Propriedades"). */
export interface PDAOptions {
  startStackSymbol?: Sym;
  acceptance?: PDAAcceptance;
}

/** Propriedades da MT que o usuário escolhe (painel "Propriedades"). */
export interface TMOptions {
  blank?: Sym;
  acceptance?: TMAcceptance;
  inputAlphabet?: Sym[];
}

export const HISTORY_LIMIT = 200;
export const UNTITLED = 'Sem título';

interface Snapshot {
  automaton: Automaton;
  layout: Layout;
}

interface DocMeta {
  past: Snapshot[];
  future: Snapshot[];
  /** Snapshot do último salvamento (null = nunca salvo). Serve para calcular `dirty`. */
  saved: Snapshot | null;
  /** O documento já foi salvo em/aberto de um arquivo (Salvar não precisa perguntar o nome). */
  hasFile: boolean;
  /** Caminho do arquivo no disco (só no app de desktop). */
  path?: string;
  /** Nome do documento no último salvamento (renomear a aba também conta como alteração). */
  savedName: string | null;
}

export interface DocumentsState {
  docs: Doc[];
  activeId: string;
  /** Histórico e estado de salvamento de cada documento (uso interno do editor). */
  meta: Record<string, DocMeta>;

  /** Aba nova e vazia do tipo pedido (padrão: AF). */
  newDoc(name?: string, kind?: AutomatonKind): void;
  /**
   * Abre numa aba nova (ex.: resultado de algoritmo). Aceita um `Automaton`
   * de qualquer tipo ou, como antes, um FA puro. Sem layout → autoLayout.
   */
  openInNewTab(name: string, automaton: Automaton | FA, layout?: Layout): void;
  /**
   * Abre um arquivo numa aba nova (a aba vazia e intocada é reaproveitada).
   * `path`: caminho no disco (desktop). `template`: exemplo/demo — abre limpo,
   * mas sem arquivo (o primeiro Salvar pergunta onde).
   */
  loadFile(file: AnyAutomatonFile, opts?: { path?: string; template?: boolean }): void;
  toFile(docId?: string): AnyAutomatonFile;
  /** Marca como salvo (tira o `•`). Opcionalmente muda o nome e guarda o caminho (desktop). */
  markSaved(docId?: string, name?: string, path?: string): void;
  closeDoc(id: string): void;
  setActive(id: string): void;
  renameDoc(id: string, name: string): void;

  // edição do documento ativo — todas entram no histórico
  addState(pos: Point): StateId;
  removeElements(states: StateId[], transitions: TransitionId[]): void;
  renameState(id: StateId, name: string): void;
  /** Torna `id` o ÚNICO estado inicial. */
  setInitial(id: StateId): void;
  toggleFinal(id: StateId): void;
  /** Arrastar = 1 entrada no histórico (chame no FIM do arrasto). */
  moveStates(moves: Record<StateId, Point>): void;
  /**
   * Só AF. Cria a transição from→to, JUNTA os símbolos com a que já existir
   * no par, ou — com lista vazia — apaga a transição do par.
   */
  setTransition(from: StateId, to: StateId, symbols: Sym[]): void;
  /** Só AF. Troca os símbolos de uma transição (lista vazia = apaga). Usado ao editar. */
  setTransitionSymbols(id: TransitionId, symbols: Sym[]): void;
  /**
   * Só AP e MT. Cria a transição from→to com estas regras, JUNTANDO com as da
   * transição que já existir no par (sem repetir regra; a ordem é mantida),
   * ou — com lista vazia — apaga a transição do par.
   */
  setRules(from: StateId, to: StateId, rules: readonly PDARule[] | readonly TMRule[]): void;
  /** Só AP e MT. Troca as regras de uma transição (lista vazia = apaga). Usado ao editar. */
  setTransitionRules(id: TransitionId, rules: readonly PDARule[] | readonly TMRule[]): void;
  /**
   * Só AP. Muda Z0 e/ou o modo de aceitação. Com `renameInRules`, o Z0 antigo
   * também é trocado pelo novo nas regras (X e γ). Símbolo inválido é ignorado.
   */
  setPDAOptions(patch: PDAOptions, opts?: { renameInRules?: boolean }): void;
  /**
   * Só MT. Muda o branco, o modo de aceitação e/ou Σ. Com `renameInRules`, o
   * branco antigo também é trocado pelo novo nas regras (X e Y).
   */
  setTMOptions(patch: TMOptions, opts?: { renameInRules?: boolean }): void;
  setEdgeLayout(id: TransitionId, e: EdgeLayout): void;
  /** Troca o layout inteiro (ex.: botão "Organizar"). */
  applyLayout(layout: Layout): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

/* ------------------------------------------------------------------ */
/* Ajudantes puros                                                     */
/* ------------------------------------------------------------------ */

/** AF vazio (útil como valor padrão nos painéis que só entendem AF). */
export const EMPTY_FA: FA = { states: [], transitions: [] };
const EMPTY_LAYOUT: Layout = { positions: {}, edges: {} };

/** Autômato novo e vazio do tipo pedido (AP: Z0 = Z; MT: branco B; os dois por estado final). */
export function emptyAutomaton(kind: AutomatonKind): Automaton {
  switch (kind) {
    case 'fa':
      return { kind: 'fa', fa: EMPTY_FA };
    case 'pda':
      return {
        kind: 'pda',
        pda: { states: [], transitions: [], startStackSymbol: DEFAULT_START_STACK_SYMBOL, acceptance: 'FINAL_STATE' },
      };
    case 'tm':
      return {
        kind: 'tm',
        tm: { states: [], transitions: [], blank: DEFAULT_BLANK, acceptance: 'FINAL_STATE', inputAlphabet: [] },
      };
  }
}

/** O AF do documento, ou null se a aba for AP ou MT. */
export function faOf(doc: Doc): FA | null {
  return doc.automaton.kind === 'fa' ? doc.automaton.fa : null;
}

/** O AP do documento, ou null se a aba não for AP. */
export function pdaOf(doc: Doc): PDA | null {
  return doc.automaton.kind === 'pda' ? doc.automaton.pda : null;
}

/** A MT do documento, ou null se a aba não for MT. */
export function tmOf(doc: Doc): TM | null {
  return doc.automaton.kind === 'tm' ? doc.automaton.tm : null;
}

/** true = o documento não tem nenhum estado. */
export function isEmptyDoc(doc: Doc): boolean {
  return graphOf(doc.automaton).states.length === 0;
}

let docCounter = 0;
const newDocId = () => `doc-${++docCounter}`;

/** Próximo id livre do tipo `${prefix}N`, sempre maior que os existentes (nunca reaproveita). */
export function nextId(prefix: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = -1;
  for (const id of taken) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Menor nome `qN` que ainda não está em uso. */
export function nextStateName(existing: Iterable<string>): string {
  const taken = new Set(existing);
  let n = 0;
  while (taken.has(`q${n}`)) n++;
  return `q${n}`;
}

/** Sem repetição, sem vazios; ordem: símbolos comuns em ordem alfabética e ε por último. */
export function normalizeSymbols(symbols: Iterable<Sym>): Sym[] {
  const set = new Set<Sym>();
  for (const s of symbols) if (s !== '') set.add(s);
  return [...set].sort((a, b) => {
    if (a === b) return 0;
    if (a === EPSILON) return 1;
    if (b === EPSILON) return -1;
    return a < b ? -1 : 1;
  });
}

/** Chave de uma regra do AP (regras iguais têm a mesma chave). */
export const pdaRuleKey = (r: PDARule) => `${r.read}\u0000${r.pop}\u0000${r.push}`;
/** Chave de uma regra da MT (regras iguais têm a mesma chave). */
export const tmRuleKey = (r: TMRule) => `${r.read}\u0000${r.write}\u0000${r.move}`;

/** Tira as regras repetidas, mantendo a ordem (a ordem importa na simulação). */
export function normalizeRules<R>(rules: readonly R[], key: (r: R) => string): R[] {
  const seen = new Set<string>();
  const out: R[] = [];
  for (const r of rules) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Exatamente 1 caractere, sem ser ε nem espaço (Z0, branco, símbolos de Σ). */
export function isOneSymbol(s: string): boolean {
  return Array.from(s).length === 1 && s !== EPSILON && !/\s/.test(s);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isPDARule(r: unknown): r is PDARule {
  return isObj(r) && typeof r.read === 'string' && typeof r.pop === 'string' && typeof r.push === 'string';
}

function isTMRule(r: unknown): r is TMRule {
  return isObj(r) && typeof r.read === 'string' && typeof r.write === 'string' && (r.move === 'L' || r.move === 'R');
}

function untitledName(docs: Doc[]): string {
  const names = new Set(docs.map((d) => d.name));
  if (!names.has(UNTITLED)) return UNTITLED;
  let n = 2;
  while (names.has(`${UNTITLED} ${n}`)) n++;
  return `${UNTITLED} ${n}`;
}

const sameSnapshot = (a: Snapshot | null, b: Snapshot) => !!a && a.automaton === b.automaton && a.layout === b.layout;

function omit<T>(rec: Record<string, T>, keys: Iterable<string>): Record<string, T> {
  const out = { ...rec };
  for (const k of keys) delete out[k];
  return out;
}

function samePoint(a: Point | undefined, b: Point): boolean {
  return !!a && a.x === b.x && a.y === b.y;
}

function makeDoc(
  name: string,
  snap: Snapshot,
  clean: boolean,
  hasFile: boolean,
  path?: string,
): { doc: Doc; meta: DocMeta } {
  const doc: Doc = { id: newDocId(), name, automaton: snap.automaton, layout: snap.layout, dirty: !clean };
  return {
    doc,
    meta: { past: [], future: [], saved: clean ? snap : null, hasFile, path, savedName: clean ? name : null },
  };
}

/* ---------- estados e setas de qualquer tipo ---------- */

type GraphTransition = GraphLike['transitions'][number];

/** Troca os estados (o formato é o mesmo nos três tipos). */
function withStates(a: Automaton, states: AutomatonState[]): Automaton {
  switch (a.kind) {
    case 'fa':
      return { kind: 'fa', fa: { ...a.fa, states } };
    case 'pda':
      return { kind: 'pda', pda: { ...a.pda, states } };
    case 'tm':
      return { kind: 'tm', tm: { ...a.tm, states } };
  }
}

/** Tira estados e transições (as que tocam um estado tirado também saem). */
function withoutElements(a: Automaton, states: ReadonlySet<StateId>, transitions: ReadonlySet<TransitionId>): Automaton {
  const keepS = <S extends AutomatonState>(list: S[]) => list.filter((s) => !states.has(s.id));
  const keepT = <T extends GraphTransition>(list: T[]) => list.filter((t) => !transitions.has(t.id));
  switch (a.kind) {
    case 'fa':
      return { kind: 'fa', fa: { states: keepS(a.fa.states), transitions: keepT(a.fa.transitions) } };
    case 'pda':
      return { kind: 'pda', pda: { ...a.pda, states: keepS(a.pda.states), transitions: keepT(a.pda.transitions) } };
    case 'tm':
      return { kind: 'tm', tm: { ...a.tm, states: keepS(a.tm.states), transitions: keepT(a.tm.transitions) } };
  }
}

/* ---------- conteúdo das setas: símbolos (AF) ou regras (AP/MT) ---------- */

/** Como ler e trocar o conteúdo de uma seta (símbolos do AF, regras do AP/MT). */
interface ItemOps<T extends GraphTransition, P> {
  items(t: T): readonly P[];
  make(id: TransitionId, from: StateId, to: StateId, items: P[]): T;
  with(t: T, items: P[]): T;
  normalize(items: readonly P[]): P[];
  key(p: P): string;
}

const FA_OPS: ItemOps<FATransition, Sym> = {
  items: (t) => t.symbols,
  make: (id, from, to, symbols) => ({ id, from, to, symbols }),
  with: (t, symbols) => ({ ...t, symbols }),
  normalize: normalizeSymbols,
  key: (s) => s,
};

const PDA_OPS: ItemOps<PDATransition, PDARule> = {
  items: (t) => t.rules,
  make: (id, from, to, rules) => ({ id, from, to, rules }),
  with: (t, rules) => ({ ...t, rules }),
  normalize: (rules) => normalizeRules(rules, pdaRuleKey),
  key: pdaRuleKey,
};

const TM_OPS: ItemOps<TMTransition, TMRule> = {
  items: (t) => t.rules,
  make: (id, from, to, rules) => ({ id, from, to, rules }),
  with: (t, rules) => ({ ...t, rules }),
  normalize: (rules) => normalizeRules(rules, tmRuleKey),
  key: tmRuleKey,
};

function sameItems<P>(a: readonly P[], b: readonly P[], key: (p: P) => string): boolean {
  return a.length === b.length && a.every((x, i) => key(x) === key(b[i]!));
}

interface Edited<T> {
  transitions: T[];
  layout: Layout;
}

/** Cria/junta/apaga a seta do par (from, to). null = nada mudou. */
function setOnPair<T extends GraphTransition, P>(
  states: readonly AutomatonState[],
  transitions: T[],
  layout: Layout,
  from: StateId,
  to: StateId,
  input: readonly P[],
  ops: ItemOps<T, P>,
): Edited<T> | null {
  const items = ops.normalize(input);
  const ids = new Set(states.map((x) => x.id));
  if (!ids.has(from) || !ids.has(to)) return null;
  const pair = transitions.filter((t) => t.from === from && t.to === to);
  if (items.length === 0) {
    if (pair.length === 0) return null;
    const gone = new Set(pair.map((t) => t.id));
    return { transitions: transitions.filter((t) => !gone.has(t.id)), layout: { ...layout, edges: omit(layout.edges, gone) } };
  }
  if (pair.length === 0) {
    const t = ops.make(nextId('t', transitions.map((x) => x.id)), from, to, items);
    const next = [...transitions, t];
    if (from !== to) {
      // nasce curva se a reta passaria por cima de outro estado
      const k = curvatureAvoiding(layout.positions, from, to);
      if (k === 0) return { transitions: next, layout };
      return { transitions: next, layout: { ...layout, edges: { ...layout.edges, [t.id]: { curvature: k } } } };
    }
    const loopAngle = bestLoopAngle({ states, transitions: next }, layout, from);
    return { transitions: next, layout: { ...layout, edges: { ...layout.edges, [t.id]: { curvature: 0, loopAngle } } } };
  }
  const keep = pair[0]!;
  const merged = ops.normalize([...pair.flatMap((t) => ops.items(t)), ...items]);
  const extra = new Set(pair.slice(1).map((t) => t.id));
  if (extra.size === 0 && sameItems(merged, ops.items(keep), ops.key)) return null;
  return {
    transitions: transitions.filter((t) => !extra.has(t.id)).map((t) => (t.id === keep.id ? ops.with(t, merged) : t)),
    layout: extra.size ? { ...layout, edges: omit(layout.edges, extra) } : layout,
  };
}

/** Troca o conteúdo da seta `id` (vazio = apaga). null = nada mudou. */
function replaceItems<T extends GraphTransition, P>(
  transitions: T[],
  layout: Layout,
  id: TransitionId,
  input: readonly P[],
  ops: ItemOps<T, P>,
): Edited<T> | null {
  const items = ops.normalize(input);
  const t = transitions.find((x) => x.id === id);
  if (!t) return null;
  if (items.length === 0) {
    return { transitions: transitions.filter((x) => x.id !== id), layout: { ...layout, edges: omit(layout.edges, [id]) } };
  }
  if (sameItems(items, ops.items(t), ops.key)) return null;
  return { transitions: transitions.map((x) => (x.id === id ? ops.with(x, items) : x)), layout };
}

/** O símbolo de pilha aparece em X ou γ de alguma regra? */
export function stackSymbolInRules(transitions: readonly PDATransition[], s: Sym): boolean {
  return transitions.some((t) => t.rules.some((r) => r.pop === s || Array.from(r.push).includes(s)));
}

/** O símbolo de fita aparece em X ou Y de alguma regra? */
export function tapeSymbolInRules(transitions: readonly TMTransition[], s: Sym): boolean {
  return transitions.some((t) => t.rules.some((r) => r.read === s || r.write === s));
}

/** Troca um símbolo de pilha (Z0) por outro em X e γ de todas as regras. */
function renameStackSymbol(transitions: PDATransition[], from: Sym, to: Sym): PDATransition[] {
  const swap = (s: string) => Array.from(s, (ch) => (ch === from ? to : ch)).join('');
  return transitions.map((t) => ({
    ...t,
    rules: normalizeRules(
      t.rules.map((r) => ({ read: r.read, pop: swap(r.pop), push: swap(r.push) })),
      pdaRuleKey,
    ),
  }));
}

/** Troca o branco antigo pelo novo em X e Y de todas as regras. */
function renameTapeSymbol(transitions: TMTransition[], from: Sym, to: Sym): TMTransition[] {
  const swap = (s: string) => (s === from ? to : s);
  return transitions.map((t) => ({
    ...t,
    rules: normalizeRules(
      t.rules.map((r) => ({ read: swap(r.read), write: swap(r.write), move: r.move })),
      tmRuleKey,
    ),
  }));
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const first = makeDoc(UNTITLED, { automaton: emptyAutomaton('fa'), layout: EMPTY_LAYOUT }, true, false);

export const useDocuments = create<DocumentsState>()((set, get) => {
  /** Documento ativo (sempre existe: nunca deixamos a lista vazia). */
  const active = (st: DocumentsState = get()): Doc => st.docs.find((d) => d.id === st.activeId) ?? st.docs[0]!;

  /** Aplica uma edição no documento ativo, como UMA entrada no histórico. */
  const edit = (produce: (s: Snapshot) => Snapshot | null) => {
    set((st) => {
      const doc = active(st);
      const cur: Snapshot = { automaton: doc.automaton, layout: doc.layout };
      const next = produce(cur);
      if (!next || (next.automaton === cur.automaton && next.layout === cur.layout)) return st;
      const m = st.meta[doc.id]!;
      const past = [...m.past, cur];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      const meta: DocMeta = { ...m, past, future: [] };
      return {
        docs: st.docs.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                automaton: next.automaton,
                layout: next.layout,
                dirty: !sameSnapshot(meta.saved, next) || meta.savedName !== d.name,
              }
            : d,
        ),
        meta: { ...st.meta, [doc.id]: meta },
      };
    });
  };

  /** Edição só de AF (em AP/MT não faz nada). */
  const editFA = (produce: (fa: FA, layout: Layout) => Edited<FATransition> | null) =>
    edit((s) => {
      if (s.automaton.kind !== 'fa') return null;
      const fa = s.automaton.fa;
      const r = produce(fa, s.layout);
      return r && { automaton: { kind: 'fa', fa: { ...fa, transitions: r.transitions } }, layout: r.layout };
    });

  /** Edição das regras de AP ou MT (só aceita regras do tipo da aba). */
  const editRules = (
    rules: readonly unknown[],
    pda: (p: PDA, layout: Layout, rules: PDARule[]) => Edited<PDATransition> | null,
    tm: (m: TM, layout: Layout, rules: TMRule[]) => Edited<TMTransition> | null,
  ) =>
    edit((s) => {
      const a = s.automaton;
      if (a.kind === 'pda') {
        if (!rules.every(isPDARule)) return null;
        const clean = rules.map((r) => ({ read: r.read, pop: r.pop, push: r.push }));
        const r = pda(a.pda, s.layout, clean);
        return r && { automaton: { kind: 'pda', pda: { ...a.pda, transitions: r.transitions } }, layout: r.layout };
      }
      if (a.kind === 'tm') {
        if (!rules.every(isTMRule)) return null;
        const clean = rules.map((r) => ({ read: r.read, write: r.write, move: r.move }));
        const r = tm(a.tm, s.layout, clean);
        return r && { automaton: { kind: 'tm', tm: { ...a.tm, transitions: r.transitions } }, layout: r.layout };
      }
      return null;
    });

  /** Insere um documento e o ativa. Uma aba vazia e intocada é substituída. */
  const insert = (entry: { doc: Doc; meta: DocMeta }, reuseEmpty: boolean) => {
    set((st) => {
      const cur = active(st);
      const m = st.meta[cur.id];
      const reusable =
        reuseEmpty &&
        isEmptyDoc(cur) &&
        !cur.dirty &&
        !!m &&
        m.past.length === 0 &&
        m.future.length === 0 &&
        !m.hasFile;
      if (reusable) {
        return {
          docs: st.docs.map((d) => (d.id === cur.id ? entry.doc : d)),
          meta: { ...omit(st.meta, [cur.id]), [entry.doc.id]: entry.meta },
          activeId: entry.doc.id,
        };
      }
      const idx = st.docs.findIndex((d) => d.id === cur.id);
      const docs = [...st.docs];
      docs.splice(idx + 1, 0, entry.doc);
      return { docs, meta: { ...st.meta, [entry.doc.id]: entry.meta }, activeId: entry.doc.id };
    });
    useHighlight.getState().clear();
  };

  const moveHistory = (dir: 'undo' | 'redo') => {
    set((st) => {
      const doc = active(st);
      const m = st.meta[doc.id]!;
      const from = dir === 'undo' ? m.past : m.future;
      if (from.length === 0) return st;
      const target = from[from.length - 1]!;
      const cur: Snapshot = { automaton: doc.automaton, layout: doc.layout };
      const rest = from.slice(0, -1);
      const other = [...(dir === 'undo' ? m.future : m.past), cur];
      if (other.length > HISTORY_LIMIT) other.splice(0, other.length - HISTORY_LIMIT);
      const meta: DocMeta =
        dir === 'undo' ? { ...m, past: rest, future: other } : { ...m, past: other, future: rest };
      return {
        docs: st.docs.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                automaton: target.automaton,
                layout: target.layout,
                dirty: !sameSnapshot(meta.saved, target) || meta.savedName !== d.name,
              }
            : d,
        ),
        meta: { ...st.meta, [doc.id]: meta },
      };
    });
  };

  return {
    docs: [first.doc],
    activeId: first.doc.id,
    meta: { [first.doc.id]: first.meta },

    newDoc(name, kind = 'fa') {
      const entry = makeDoc(
        name?.trim() || untitledName(get().docs),
        { automaton: emptyAutomaton(kind), layout: EMPTY_LAYOUT },
        true,
        false,
      );
      insert(entry, false);
    },

    openInNewTab(name, input, layout) {
      const automaton: Automaton = 'kind' in input ? input : { kind: 'fa', fa: input };
      const entry = makeDoc(
        name.trim() || untitledName(get().docs),
        { automaton, layout: ensureLayout(graphOf(automaton), layout) },
        false,
        false,
      );
      insert(entry, true);
    },

    loadFile(file, opts) {
      const automaton = automatonOf(file);
      const entry = makeDoc(
        file.name?.trim() || untitledName(get().docs),
        { automaton, layout: ensureLayout(graphOf(automaton), file.layout) },
        true,
        !opts?.template,
        opts?.path,
      );
      insert(entry, true);
    },

    toFile(docId) {
      const st = get();
      const doc = (docId && st.docs.find((d) => d.id === docId)) || active(st);
      return fileOf(doc.name, doc.automaton, doc.layout);
    },

    markSaved(docId, name, path) {
      set((st) => {
        const doc = (docId && st.docs.find((d) => d.id === docId)) || active(st);
        const m = st.meta[doc.id]!;
        const newName = name?.trim() || doc.name;
        return {
          docs: st.docs.map((d) => (d.id === doc.id ? { ...d, name: newName, dirty: false } : d)),
          meta: {
            ...st.meta,
            [doc.id]: {
              ...m,
              saved: { automaton: doc.automaton, layout: doc.layout },
              hasFile: true,
              path: path ?? m.path,
              savedName: newName,
            },
          },
        };
      });
    },

    closeDoc(id) {
      const st = get();
      const idx = st.docs.findIndex((d) => d.id === id);
      if (idx < 0) return;
      const docs = st.docs.filter((d) => d.id !== id);
      const meta = omit(st.meta, [id]);
      if (docs.length === 0) {
        const entry = makeDoc(UNTITLED, { automaton: emptyAutomaton('fa'), layout: EMPTY_LAYOUT }, true, false);
        set({ docs: [entry.doc], meta: { ...meta, [entry.doc.id]: entry.meta }, activeId: entry.doc.id });
        useHighlight.getState().clear();
        return;
      }
      if (st.activeId === id) {
        const next = docs[Math.min(idx, docs.length - 1)]!;
        set({ docs, meta, activeId: next.id });
        useHighlight.getState().clear();
      } else {
        set({ docs, meta });
      }
    },

    setActive(id) {
      const st = get();
      if (st.activeId === id || !st.docs.some((d) => d.id === id)) return;
      set({ activeId: id });
      useHighlight.getState().clear();
    },

    renameDoc(id, name) {
      const clean = name.trim();
      if (!clean) return;
      set((st) => {
        const m = st.meta[id];
        return {
          docs: st.docs.map((d) =>
            d.id === id
              ? { ...d, name: clean, dirty: !m || !sameSnapshot(m.saved, d) || m.savedName !== clean }
              : d,
          ),
        };
      });
    },

    addState(pos) {
      const g = graphOf(active().automaton);
      const id = nextId('q', g.states.map((s) => s.id));
      const name = nextStateName(g.states.map((s) => s.name));
      const state: AutomatonState = { id, name, initial: g.states.length === 0, final: false };
      edit((s) => ({
        automaton: withStates(s.automaton, [...graphOf(s.automaton).states, state]),
        layout: { ...s.layout, positions: { ...s.layout.positions, [id]: { x: Math.round(pos.x), y: Math.round(pos.y) } } },
      }));
      return id;
    },

    removeElements(states, transitions) {
      const S = new Set(states);
      const T = new Set(transitions);
      edit((s) => {
        const g = graphOf(s.automaton);
        const goneStates = g.states.filter((st) => S.has(st.id));
        const goneTrans = g.transitions.filter((t) => T.has(t.id) || S.has(t.from) || S.has(t.to));
        if (goneStates.length === 0 && goneTrans.length === 0) return null;
        const goneT = new Set(goneTrans.map((t) => t.id));
        return {
          automaton: withoutElements(s.automaton, S, goneT),
          layout: { positions: omit(s.layout.positions, S), edges: omit(s.layout.edges, goneT) },
        };
      });
    },

    renameState(id, name) {
      const clean = name.trim();
      if (!clean) return;
      edit((s) => {
        const states = graphOf(s.automaton).states;
        const st = states.find((x) => x.id === id);
        if (!st || st.name === clean) return null;
        return { ...s, automaton: withStates(s.automaton, states.map((x) => (x.id === id ? { ...x, name: clean } : x))) };
      });
    },

    setInitial(id) {
      edit((s) => {
        const states = graphOf(s.automaton).states;
        if (!states.some((x) => x.id === id)) return null;
        if (states.every((x) => x.initial === (x.id === id))) return null;
        return { ...s, automaton: withStates(s.automaton, states.map((x) => ({ ...x, initial: x.id === id }))) };
      });
    },

    toggleFinal(id) {
      edit((s) => {
        const states = graphOf(s.automaton).states;
        if (!states.some((x) => x.id === id)) return null;
        return {
          ...s,
          automaton: withStates(s.automaton, states.map((x) => (x.id === id ? { ...x, final: !x.final } : x))),
        };
      });
    },

    moveStates(moves) {
      edit((s) => {
        const states = graphOf(s.automaton).states;
        const positions = { ...s.layout.positions };
        let changed = false;
        for (const [id, p] of Object.entries(moves)) {
          if (!states.some((x) => x.id === id)) continue;
          const q = { x: Math.round(p.x), y: Math.round(p.y) };
          if (samePoint(positions[id], q)) continue;
          positions[id] = q;
          changed = true;
        }
        return changed ? { ...s, layout: { ...s.layout, positions } } : null;
      });
    },

    setTransition(from, to, symbols) {
      editFA((fa, layout) => setOnPair(fa.states, fa.transitions, layout, from, to, symbols, FA_OPS));
    },

    setTransitionSymbols(id, symbols) {
      editFA((fa, layout) => replaceItems(fa.transitions, layout, id, symbols, FA_OPS));
    },

    setRules(from, to, rules) {
      editRules(
        rules,
        (pda, layout, list) => setOnPair(pda.states, pda.transitions, layout, from, to, list, PDA_OPS),
        (tm, layout, list) => setOnPair(tm.states, tm.transitions, layout, from, to, list, TM_OPS),
      );
    },

    setTransitionRules(id, rules) {
      editRules(
        rules,
        (pda, layout, list) => replaceItems(pda.transitions, layout, id, list, PDA_OPS),
        (tm, layout, list) => replaceItems(tm.transitions, layout, id, list, TM_OPS),
      );
    },

    setPDAOptions(patch, opts) {
      edit((s) => {
        const a = s.automaton;
        if (a.kind !== 'pda') return null;
        let pda = a.pda;
        const z = patch.startStackSymbol;
        // trocar nas regras para um símbolo que JÁ está nelas juntaria os dois e mudaria a linguagem: recusa
        const merges = z !== undefined && !!opts?.renameInRules && stackSymbolInRules(pda.transitions, z);
        if (z !== undefined && isOneSymbol(z) && z !== pda.startStackSymbol && !merges) {
          const transitions = opts?.renameInRules ? renameStackSymbol(pda.transitions, pda.startStackSymbol, z) : pda.transitions;
          pda = { ...pda, startStackSymbol: z, transitions };
        }
        if ((patch.acceptance === 'FINAL_STATE' || patch.acceptance === 'EMPTY_STACK') && patch.acceptance !== pda.acceptance) {
          pda = { ...pda, acceptance: patch.acceptance };
        }
        return pda === a.pda ? null : { automaton: { kind: 'pda', pda }, layout: s.layout };
      });
    },

    setTMOptions(patch, opts) {
      edit((s) => {
        const a = s.automaton;
        if (a.kind !== 'tm') return null;
        let tm = a.tm;
        const b = patch.blank;
        // trocar nas regras para um símbolo que JÁ está nelas juntaria os dois e mudaria a linguagem: recusa
        const merges = b !== undefined && !!opts?.renameInRules && tapeSymbolInRules(tm.transitions, b);
        if (b !== undefined && isOneSymbol(b) && b !== tm.blank && !merges) {
          const transitions = opts?.renameInRules ? renameTapeSymbol(tm.transitions, tm.blank, b) : tm.transitions;
          tm = { ...tm, blank: b, transitions };
        }
        if ((patch.acceptance === 'FINAL_STATE' || patch.acceptance === 'HALT') && patch.acceptance !== tm.acceptance) {
          tm = { ...tm, acceptance: patch.acceptance };
        }
        // Σ: 1 caractere cada, sem repetir, em ordem e nunca com o branco (contrato)
        if (patch.inputAlphabet || tm.blank !== a.tm.blank) {
          const blank = tm.blank;
          const sigma = [...new Set((patch.inputAlphabet ?? tm.inputAlphabet).filter((x) => isOneSymbol(x) && x !== blank))].sort();
          if (!sameList(sigma, tm.inputAlphabet)) tm = { ...tm, inputAlphabet: sigma };
        }
        return tm === a.tm ? null : { automaton: { kind: 'tm', tm }, layout: s.layout };
      });
    },

    setEdgeLayout(id, e) {
      edit((s) => {
        if (!graphOf(s.automaton).transitions.some((t) => t.id === id)) return null;
        const old = s.layout.edges[id];
        if (old && old.curvature === e.curvature && old.loopAngle === e.loopAngle) return null;
        return { ...s, layout: { ...s.layout, edges: { ...s.layout.edges, [id]: { ...e } } } };
      });
    },

    applyLayout(layout) {
      edit((s) => ({ ...s, layout }));
    },

    undo: () => moveHistory('undo'),
    redo: () => moveHistory('redo'),
    canUndo: () => (get().meta[get().activeId]?.past.length ?? 0) > 0,
    canRedo: () => (get().meta[get().activeId]?.future.length ?? 0) > 0,
  };
});

/** Documento da aba ativa. */
export function useActiveDoc(): Doc {
  return useDocuments((s) => s.docs.find((d) => d.id === s.activeId) ?? s.docs[0]!);
}

/** Tipo do autômato da aba ativa ('fa', 'pda' ou 'tm'). */
export function useActiveKind(): AutomatonKind {
  return useDocuments((s) => (s.docs.find((d) => d.id === s.activeId) ?? s.docs[0]!).automaton.kind);
}

/** Documento ativo fora de componentes React. */
export function getActiveDoc(): Doc {
  const s = useDocuments.getState();
  return s.docs.find((d) => d.id === s.activeId) ?? s.docs[0]!;
}
