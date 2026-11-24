/**
 * Lógica pura da simulação na tela: qual destaque mostrar em cada passo,
 * a fita, a linha do tempo e a explicação de cada passo.
 */
import type { FA, SimulationResult, StateId, Sym } from '../../core/fa/types';
import type { HighlightData } from '../../store/highlight';
import { formatStates, nameMap } from '../ferramentas/format';

export const NO_HIGHLIGHT: HighlightData = { active: [], viaEpsilon: [], transitions: [], status: 'idle' };

/** Índice do último passo (-1 quando não há passos). */
export function lastStep(result: SimulationResult | null): number {
  return result ? result.steps.length - 1 : -1;
}

/** Mantém `step` dentro de [0, último]. */
export function clampStep(result: SimulationResult | null, step: number): number {
  const last = lastStep(result);
  if (last < 0) return -1;
  return Math.max(0, Math.min(last, Math.trunc(step)));
}

/** O resultado (ACEITA/REJEITA) já pode ser mostrado? */
export function isFinished(result: SimulationResult | null, step: number): boolean {
  if (!result) return false;
  return result.steps.length === 0 || step >= lastStep(result);
}

/** Destaque do canvas para o passo `step`. */
export function highlightFor(result: SimulationResult | null, step: number): HighlightData {
  if (!result || result.steps.length === 0) return NO_HIGHLIGHT;
  const i = clampStep(result, step);
  const s = result.steps[i]!;
  const final = i === lastStep(result);
  if (!final) return { active: s.active, viaEpsilon: s.viaEpsilon, transitions: s.usedTransitions, status: 'running' };
  if (result.reason === 'DEAD_END' && s.active.length === 0) {
    // mostra em vermelho onde a simulação ficou presa
    const prev = result.steps[i - 1];
    return { active: prev?.active ?? [], viaEpsilon: [], transitions: [], status: 'rejected' };
  }
  return {
    active: s.active,
    viaEpsilon: s.viaEpsilon,
    transitions: s.usedTransitions,
    status: result.accepted ? 'accepted' : 'rejected',
  };
}

/* ------------------------------------------------------------------ */
/* Fita                                                                */
/* ------------------------------------------------------------------ */

export type CellKind = 'read' | 'current' | 'pending' | 'error';

export interface TapeCell {
  ch: string;
  kind: CellKind;
  /** Símbolo que nenhuma transição usa (fora de Σ). */
  foreign: boolean;
}

export interface TapeModel {
  cells: TapeCell[];
  /** Posição da cabeça: 0..n (n = depois do último símbolo); -1 = escondida. */
  head: number;
  tone: 'idle' | 'running' | 'accepted' | 'rejected';
}

export function tapeModel(word: string, sigma: readonly Sym[], result: SimulationResult | null, step: number): TapeModel {
  const chars = Array.from(word);
  const inSigma = new Set(sigma);
  const cells: TapeCell[] = chars.map((ch) => ({ ch, kind: 'pending', foreign: !inSigma.has(ch) }));
  if (!result || result.steps.length === 0) {
    return { cells, head: -1, tone: result ? 'rejected' : 'idle' };
  }
  const i = clampStep(result, step);
  const s = result.steps[i]!;
  const finished = i === lastStep(result);
  let head = Array.from(s.consumed).length;
  let errorAt = -1;
  if (finished && (result.reason === 'DEAD_END' || result.reason === 'SYMBOL_NOT_IN_ALPHABET')) {
    errorAt = result.stoppedAt ?? head;
    head = errorAt;
  }
  cells.forEach((c, k) => {
    if (k === errorAt) c.kind = 'error';
    else if (k < head) c.kind = 'read';
    else if (k === head && !finished) c.kind = 'current';
  });
  const tone = finished ? (result.accepted ? 'accepted' : 'rejected') : 'running';
  return { cells, head, tone };
}

/* ------------------------------------------------------------------ */
/* Linha do tempo                                                      */
/* ------------------------------------------------------------------ */

export interface TimelineState {
  id: StateId;
  name: string;
  viaEpsilon: boolean;
}

export interface TimelineItem {
  index: number;
  /** Símbolo lido para chegar aqui (null no passo 0). */
  read: Sym | null;
  states: TimelineState[];
  /** Conjunto vazio: a simulação morreu aqui. */
  dead: boolean;
}

export function timeline(fa: FA, result: SimulationResult | null): TimelineItem[] {
  if (!result) return [];
  const names = nameMap(fa);
  return result.steps.map((s) => {
    const via = new Set(s.viaEpsilon);
    return {
      index: s.index,
      read: s.read,
      states: s.active.map((id) => ({ id, name: names.get(id) ?? id, viaEpsilon: via.has(id) })),
      dead: s.active.length === 0,
    };
  });
}

/** "{q0} --a--> {q0,q1}" (texto de um passo da linha do tempo). */
export function timelineText(fa: FA, result: SimulationResult): string {
  return result.steps
    .map((s) => (s.read === null ? '' : ` --${s.read}--> `) + formatStates(fa, s.active))
    .join('');
}

/* ------------------------------------------------------------------ */
/* Explicação do passo                                                 */
/* ------------------------------------------------------------------ */

export interface StepExplanation {
  title: string;
  /** Fórmulas, ex.: "δ(q0, 1) = q1", "ECLOSE({q1}) = {q1,q2}". */
  lines: string[];
}

export function explainStep(fa: FA, result: SimulationResult, step: number): StepExplanation | null {
  if (result.steps.length === 0) return null;
  const i = clampStep(result, step);
  const s = result.steps[i]!;
  const via = new Set(s.viaEpsilon);
  if (i === 0) {
    const initials = s.active.filter((id) => !via.has(id));
    const from = initials.length === 1 ? (nameMap(fa).get(initials[0]!) ?? initials[0]!) : formatStates(fa, initials);
    if (s.viaEpsilon.length === 0) return { title: 'Início', lines: [`começa em ${from}, antes de ler qualquer símbolo`] };
    return { title: 'Início', lines: [`ECLOSE(${from}) = ${formatStates(fa, s.active)}`] };
  }
  const prev = result.steps[i - 1]!;
  const sym = s.read ?? '?';
  const direct = s.active.filter((id) => !via.has(id));
  const names = nameMap(fa);
  const single = prev.active.length === 1 && direct.length <= 1 && s.viaEpsilon.length === 0;
  const lines: string[] = [];
  if (single) {
    const from = names.get(prev.active[0]!) ?? prev.active[0]!;
    const to = direct.length === 1 ? (names.get(direct[0]!) ?? direct[0]!) : '∅';
    lines.push(`δ(${from}, ${sym}) = ${to}`);
  } else {
    lines.push(`δ(${formatStates(fa, prev.active)}, ${sym}) = ${formatStates(fa, direct)}`);
    if (s.viaEpsilon.length > 0) lines.push(`ECLOSE(${formatStates(fa, direct)}) = ${formatStates(fa, s.active)}`);
  }
  return { title: `Leu '${sym}'`, lines };
}
