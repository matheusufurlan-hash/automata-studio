/**
 * Formatação de AP e MT para a tela (funções puras): avisos do validate,
 * selo do tipo, definição formal na notação do Hopcroft e a tabela de
 * transição da MT (como a figura 8.10 do livro).
 */
import { EPSILON } from '../../core/common';
import type { StateId } from '../../core/common';
import type { PDA, PDAFormalDefinition, PDAType, PDAValidationIssue } from '../../core/pda/types';
import type { TM, TMFormalDefinition, TMType, TMValidationIssue } from '../../core/tm/types';
import { ARROW, formatPDARule, formatTMRule } from '../editor/rules';
import { formatSet } from './format';

/* ------------------------------------------------------------------ */
/* Selo do tipo                                                        */
/* ------------------------------------------------------------------ */

export type MachineType = PDAType | TMType;

export const MACHINE_TYPE_LABEL: Record<MachineType, string> = {
  EMPTY: 'Vazio',
  PDA: 'AP',
  DPDA: 'APD',
  DTM: 'MTD',
  NTM: 'MTN',
};

export const MACHINE_TYPE_DESCRIPTION: Record<MachineType, string> = {
  EMPTY: 'Ainda não há estados.',
  PDA: 'Autômato com pilha não determinístico: em algum momento ele pode escolher entre mais de um movimento.',
  DPDA: 'Autômato com pilha determinístico (APD, seção 6.4): nunca há duas escolhas ao mesmo tempo.',
  DTM: 'Máquina de Turing determinística: para cada estado e símbolo lido, no máximo uma regra.',
  NTM: 'Máquina de Turing não determinística: algum estado tem mais de uma regra para o mesmo símbolo.',
};

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

type Named = { states: ReadonlyArray<{ id: StateId; name: string }> };

function names(a: Named, ids: readonly StateId[]): string {
  const map = new Map(a.states.map((s) => [s.id, s.name]));
  return ids.map((id) => map.get(id) ?? id).join(', ');
}

function arrowText(a: Named & { transitions: ReadonlyArray<{ id: string; from: StateId; to: StateId }> }, id: string): string {
  const t = a.transitions.find((x) => x.id === id);
  if (!t) return id;
  const map = new Map(a.states.map((s) => [s.id, s.name]));
  return `${map.get(t.from) ?? t.from} → ${map.get(t.to) ?? t.to}`;
}

export function pdaIssueText(pda: PDA, issue: PDAValidationIssue): string {
  const rule = (tid: string, i: number) => {
    const r = pda.transitions.find((t) => t.id === tid)?.rules[i];
    return r ? `“${formatPDARule(r)}” em ${arrowText(pda, tid)}` : `uma regra de ${arrowText(pda, tid)}`;
  };
  switch (issue.kind) {
    case 'NO_INITIAL_STATE':
      return 'Sem estado inicial: selecione um estado e aperte I (ou clique com o botão direito → Inicial).';
    case 'MULTIPLE_INITIAL_STATES':
      return `Mais de um estado inicial (${names(pda, issue.states)}). Só pode haver um.`;
    case 'DANGLING_TRANSITION':
      return `A transição ${arrowText(pda, issue.transition)} aponta para um estado que não existe.`;
    case 'DUPLICATE_NAME':
      return `${issue.states.length} estados se chamam “${issue.name}”. Renomeie para não confundir nas IDs.`;
    case 'INVALID_READ':
      return `Regra inválida ${rule(issue.transition, issue.rule)}: a entrada (a) precisa ser 1 símbolo ou ε. Ela é ignorada.`;
    case 'INVALID_POP':
      return `Regra inválida ${rule(issue.transition, issue.rule)}: o topo (X) precisa ser exatamente 1 símbolo, e não ε. Ela é ignorada.`;
    case 'INVALID_PUSH':
      return `Regra inválida ${rule(issue.transition, issue.rule)}: em γ, use ε sozinho ou só símbolos. Ela é ignorada.`;
    case 'INVALID_START_STACK_SYMBOL':
      return `O símbolo inicial da pilha (Z₀ = “${pda.startStackSymbol}”) precisa ser exatamente 1 símbolo.`;
  }
}

export function tmIssueText(tm: TM, issue: TMValidationIssue): string {
  const rule = (tid: string, i: number) => {
    const r = tm.transitions.find((t) => t.id === tid)?.rules[i];
    return r ? `“${formatTMRule(r)}” em ${arrowText(tm, tid)}` : `uma regra de ${arrowText(tm, tid)}`;
  };
  switch (issue.kind) {
    case 'NO_INITIAL_STATE':
      return 'Sem estado inicial: selecione um estado e aperte I (ou clique com o botão direito → Inicial).';
    case 'MULTIPLE_INITIAL_STATES':
      return `Mais de um estado inicial (${names(tm, issue.states)}). Só pode haver um.`;
    case 'DANGLING_TRANSITION':
      return `A transição ${arrowText(tm, issue.transition)} aponta para um estado que não existe.`;
    case 'DUPLICATE_NAME':
      return `${issue.states.length} estados se chamam “${issue.name}”. Renomeie para não confundir nas IDs.`;
    case 'INVALID_READ':
      return `Regra inválida ${rule(issue.transition, issue.rule)}: o símbolo lido (X) precisa ser exatamente 1 símbolo. Ela é ignorada.`;
    case 'INVALID_WRITE':
      return `Regra inválida ${rule(issue.transition, issue.rule)}: o símbolo escrito (Y) precisa ser exatamente 1 símbolo. Ela é ignorada.`;
    case 'INVALID_MOVE':
      return `Regra inválida em ${arrowText(tm, issue.transition)}: a direção precisa ser → ou ←. Ela é ignorada.`;
    case 'INVALID_BLANK':
      return `O branco (“${tm.blank}”) precisa ser exatamente 1 símbolo.`;
    case 'BLANK_IN_INPUT_ALPHABET':
      return `Σ não pode ter o branco ${tm.blank}: a entrada nunca tem brancos.`;
    case 'INVALID_INPUT_SYMBOL':
      return `Σ tem “${issue.symbol}”, que não é 1 símbolo só.`;
  }
}

/** Estados e transições citados no aviso (para selecionar no canvas). */
export function issueTargets(issue: PDAValidationIssue | TMValidationIssue): { states: StateId[]; transitions: string[] } | null {
  switch (issue.kind) {
    case 'MULTIPLE_INITIAL_STATES':
    case 'DUPLICATE_NAME':
      return { states: issue.states, transitions: [] };
    case 'DANGLING_TRANSITION':
    case 'INVALID_READ':
    case 'INVALID_POP':
    case 'INVALID_PUSH':
    case 'INVALID_WRITE':
    case 'INVALID_MOVE':
      return { states: [], transitions: [issue.transition] };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Definição formal                                                    */
/* ------------------------------------------------------------------ */

export interface PDAFormalLines {
  Q: string;
  Sigma: string;
  Gamma: string;
  q0: string;
  Z0: string;
  F: string;
  /** "δ(q0, 0, Z) = {(q0, 0Z)}" — uma linha por (q, a, X). */
  delta: Array<{ from: string; read: string; pop: string; text: string; targets: string }>;
}

export function pdaFormalLines(def: PDAFormalDefinition): PDAFormalLines {
  return {
    Q: formatSet(def.states, ', '),
    Sigma: formatSet(def.inputAlphabet, ', '),
    Gamma: formatSet(def.stackAlphabet, ', '),
    q0: def.initial ?? '—',
    Z0: def.startStackSymbol,
    F: formatSet(def.finals, ', '),
    delta: def.delta.map((d) => {
      const targets = `{${d.to.map((t) => `(${t.state}, ${t.push || EPSILON})`).join(', ')}}`;
      return { from: d.from, read: d.read, pop: d.pop, text: `δ(${d.from}, ${d.read}, ${d.pop})`, targets };
    }),
  };
}

export interface TMFormalLines {
  Q: string;
  Sigma: string;
  Gamma: string;
  q0: string;
  B: string;
  F: string;
}

export function tmFormalLines(def: TMFormalDefinition): TMFormalLines {
  return {
    Q: formatSet(def.states, ', '),
    Sigma: formatSet(def.inputAlphabet, ', '),
    Gamma: formatSet(def.tapeAlphabet, ', '),
    q0: def.initial ?? '—',
    B: def.blank,
    F: formatSet(def.finals, ', '),
  };
}

/* ------------------------------------------------------------------ */
/* Tabela de transição da MT (figura 8.10 do Hopcroft)                */
/* ------------------------------------------------------------------ */

export interface TMTableCell {
  symbol: string;
  /** "(q1, X, →)"; NTM: um por destino. Vazio = sem regra. */
  moves: string[];
}

export interface TMTableRow {
  name: string;
  initial: boolean;
  final: boolean;
  cells: TMTableCell[];
}

export interface TMTable {
  /** Γ, com o branco por último. */
  symbols: string[];
  rows: TMTableRow[];
}

export function tmTable(def: TMFormalDefinition, initialName: string | null, finals: readonly string[]): TMTable {
  const symbols = def.tapeAlphabet;
  const finalSet = new Set(finals);
  const byState = new Map<string, Map<string, string[]>>();
  for (const d of def.delta) {
    let row = byState.get(d.from);
    if (!row) {
      row = new Map();
      byState.set(d.from, row);
    }
    row.set(
      d.read,
      d.to.map((t) => `(${t.state}, ${t.write}, ${ARROW[t.move]})`),
    );
  }
  return {
    symbols,
    rows: def.states.map((name) => ({
      name,
      initial: name === initialName,
      final: finalSet.has(name),
      cells: symbols.map((symbol) => ({ symbol, moves: byState.get(name)?.get(symbol) ?? [] })),
    })),
  };
}
