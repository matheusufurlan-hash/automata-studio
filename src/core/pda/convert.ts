/**
 * Conversões entre os modos de aceitação (Hopcroft, seção 6.2.3 e 6.2.4).
 *
 * As duas construções começam igual: um novo inicial p0 empilha Z0 em cima
 * de um fundo novo X0 (que não está em Γ) e vai para o antigo inicial q0.
 * O X0 só aparece no topo quando o AP original esvaziou a pilha.
 *
 *  - toFinalState (Teorema 6.9, N(P) → L(P_F)): de cada estado q, a regra
 *    "ε, X0/ε" leva ao novo final pf.
 *  - toEmptyStack (Teorema 6.11, L(P) → N(P_N)): de cada final q, "ε, Y/ε"
 *    (para todo Y ∈ Γ ∪ {X0}) leva a p, que esvazia a pilha com o laço
 *    "ε, Y/ε".
 *
 * Saída: ids e nomes originais mantidos (cópia limpa, ver normalize); os
 * estados originais deixam de ser iniciais e finais (no Hopcroft, F não
 * importa em P_N, e em P_F o único final é pf); estados novos ganham o 1º id
 * "qN" livre e os nomes p0, pf, p (com apóstrofo se o nome já existir);
 * transições novas ganham o 1º id "tN" livre, depois das originais.
 *
 * Sem estado inicial, p0 fica sem a transição para q0: a linguagem continua
 * vazia, como a do original.
 */
import { EPSILON } from './types';
import type { PDA, PDARule, PDAState, PDATransition, StateId, Sym } from './types';
import { buildGraph, freshBottom, freshId, normalize, primedName } from './internal';

export function toFinalState(pda: PDA): PDA {
  if (pda.acceptance === 'FINAL_STATE') return normalize(pda);
  const b = new Builder(pda);
  const pf = b.addState('pf', false, true);
  for (const q of b.originalIds) b.addTransition(q, pf, [b.popBottom]);
  return b.result('FINAL_STATE');
}

export function toEmptyStack(pda: PDA): PDA {
  if (pda.acceptance === 'EMPTY_STACK') return normalize(pda);
  const b = new Builder(pda);
  const p = b.addState('p', false, false);
  const popAll: PDARule[] = [...b.gamma, b.bottom].map((y) => ({ read: EPSILON, pop: y, push: '' }));
  for (const q of b.originalFinals) b.addTransition(q, p, popAll);
  b.addTransition(p, p, popAll);
  return b.result('EMPTY_STACK');
}

/** Monta P_F ou P_N: cópia limpa do original + p0 + o que cada construção acrescenta. */
class Builder {
  readonly originalIds: StateId[];
  readonly originalFinals: StateId[];
  /** Γ do original, em ordem. */
  readonly gamma: Sym[];
  /** X0: o novo fundo de pilha. */
  readonly bottom: Sym;
  /** "ε, X0/ε" */
  readonly popBottom: PDARule;

  private readonly states: PDAState[];
  private readonly transitions: PDATransition[];
  private readonly usedStateIds: Set<string>;
  private readonly usedNames: Set<string>;
  private readonly usedTransitionIds: Set<string>;

  constructor(pda: PDA) {
    const g = buildGraph(pda);
    const base = normalize(pda);
    this.gamma = g.gamma;
    this.bottom = freshBottom(g);
    this.popBottom = { read: EPSILON, pop: this.bottom, push: '' };
    this.originalIds = base.states.map((s) => s.id);
    this.originalFinals = base.states.filter((s) => s.final).map((s) => s.id);
    this.states = base.states.map((s) => ({ ...s, initial: false, final: false }));
    this.transitions = base.transitions;
    this.usedStateIds = new Set(pda.states.map((s) => s.id));
    this.usedNames = new Set(pda.states.map((s) => s.name));
    this.usedTransitionIds = new Set([...pda.transitions.map((t) => t.id), ...base.transitions.map((t) => t.id)]);

    const p0 = this.addState('p0', true, false);
    if (g.initial !== null) {
      this.addTransition(p0, g.initial, [{ read: EPSILON, pop: this.bottom, push: pda.startStackSymbol + this.bottom }]);
    }
  }

  addState(name: string, initial: boolean, final: boolean): StateId {
    const id = freshId(this.usedStateIds, 'q');
    const unique = primedName(this.usedNames, name);
    this.usedStateIds.add(id);
    this.usedNames.add(unique);
    this.states.push({ id, name: unique, initial, final });
    return id;
  }

  addTransition(from: StateId, to: StateId, rules: PDARule[]): void {
    const id = freshId(this.usedTransitionIds, 't');
    this.usedTransitionIds.add(id);
    this.transitions.push({ id, from, to, rules: rules.map((r) => ({ ...r })) });
  }

  result(acceptance: PDA['acceptance']): PDA {
    return { states: this.states, transitions: this.transitions, startStackSymbol: this.bottom, acceptance };
  }
}
