/**
 * Simulação do AP: busca em largura na árvore de descrições instantâneas
 * (q, w, γ) do Hopcroft.
 *
 * Regras da árvore:
 *  - raiz = (q0, palavra, Z0); filhos na ordem das transições e, dentro de
 *    cada uma, na ordem das regras;
 *  - uma ID que já apareceu antes (em qualquer ramo) é REPEATED e não é
 *    expandida; uma ID que aceita é ACCEPTING e não é expandida;
 *  - expandir é "tudo ou nada": um nó EXPANDED tem TODOS os filhos. Se os
 *    filhos não cabem em `maxNodes`, a busca para antes dele: ele e o resto
 *    da fila ficam UNEXPLORED e `limitReached = true`;
 *  - sem `exploreAll`, a busca para assim que nasce a 1ª ID que aceita (é a
 *    mais rasa, porque os nós nascem em ordem de profundidade): o resto da
 *    fila fica UNEXPLORED e `limitReached = false`;
 *  - salvaguarda de memória: um ciclo de ε que empilha sem parar nunca repete
 *    a ID e a pilha cresce a cada nível. Além de `maxNodes`, a busca também
 *    para (como LIMIT_REACHED) se as pilhas da árvore somarem mais de
 *    MAX_STACK_SYMBOLS símbolos.
 */
import { EPSILON, PDA_DEFAULT_MAX_NODES } from './types';
import type {
  PDA,
  PDAConfig,
  PDAIDNode,
  PDASimulateOptions,
  PDASimulationResult,
  RuleRef,
  StateId,
} from './types';
import { buildGraph, type Graph } from './internal';

/** Soma máxima do tamanho das pilhas guardadas na árvore (salvaguarda de memória). */
export const MAX_STACK_SYMBOLS = 30_000_000;

export function simulate(pda: PDA, word: string, opts?: PDASimulateOptions): PDASimulationResult {
  return simulateInGraph(buildGraph(pda), pda, word, opts);
}

/** Versão para quem simula muitas palavras no mesmo AP. */
export function simulateInGraph(
  g: Graph,
  pda: PDA,
  word: string,
  opts: PDASimulateOptions = {},
): PDASimulationResult {
  const acceptance = pda.acceptance;
  const maxNodes = limit(opts.maxNodes, PDA_DEFAULT_MAX_NODES);
  const exploreAll = opts.exploreAll ?? false;

  if (g.initial === null) {
    return { accepted: false, acceptance, tree: [], path: [], limitReached: false, reason: 'NO_INITIAL_STATE' };
  }

  const root: PDAIDNode = {
    index: 0,
    parent: null,
    children: [],
    config: { state: g.initial, remaining: word, stack: pda.startStackSymbol },
    via: null,
    depth: 0,
    status: 'UNEXPLORED',
  };
  const tree: PDAIDNode[] = [root];

  const bad = Array.from(word).findIndex((c) => !g.sigmaSet.has(c));
  if (bad >= 0) {
    return {
      accepted: false,
      acceptance,
      tree,
      path: [0],
      limitReached: false,
      reason: 'SYMBOL_NOT_IN_ALPHABET',
      stoppedAt: bad,
    };
  }

  const accepting = (c: PDAConfig) =>
    c.remaining === '' && (acceptance === 'EMPTY_STACK' ? c.stack === '' : g.finals.has(c.state));

  let firstAccepting = -1;
  let limitReached = false;
  let memoryLimit = false;

  if (accepting(root.config)) {
    root.status = 'ACCEPTING';
    firstAccepting = 0;
  } else {
    const visited = new Visited();
    visited.add(root.config);
    let stackSymbols = root.config.stack.length;
    const queue: number[] = [0];
    for (let head = 0; head < queue.length; head++) {
      const node = tree[queue[head]!]!;
      const next = successors(g, node.config);
      if (next.length === 0) {
        node.status = 'DEAD';
        continue;
      }
      const extra = next.reduce((sum, s) => sum + s.config.stack.length, 0);
      if (tree.length + next.length > maxNodes || stackSymbols + extra > MAX_STACK_SYMBOLS) {
        limitReached = true;
        memoryLimit = tree.length + next.length <= maxNodes;
        break;
      }
      stackSymbols += extra;
      node.status = 'EXPANDED';
      for (const { config, via } of next) {
        const child: PDAIDNode = {
          index: tree.length,
          parent: node.index,
          children: [],
          config,
          via,
          depth: node.depth + 1,
          status: 'UNEXPLORED',
        };
        tree.push(child);
        node.children.push(child.index);
        if (!visited.add(config)) {
          child.status = 'REPEATED';
        } else if (accepting(config)) {
          child.status = 'ACCEPTING';
          if (firstAccepting < 0) firstAccepting = child.index;
        } else {
          queue.push(child.index);
        }
      }
      if (firstAccepting >= 0 && !exploreAll) break;
    }
  }

  const accepted = firstAccepting >= 0;
  const path = pathTo(tree, accepted ? firstAccepting : readMost(tree));
  const memory = memoryLimit ? { memoryLimit } : {};
  if (accepted) return { accepted, acceptance, tree, path, limitReached, ...memory };
  return {
    accepted,
    acceptance,
    tree,
    path,
    limitReached,
    ...memory,
    reason: limitReached ? 'LIMIT_REACHED' : 'NO_ACCEPTING_PATH',
  };
}

/** IDs filhas de `c`, na ordem das transições e das regras. */
export function successors(g: Graph, c: PDAConfig): Array<{ config: PDAConfig; via: RuleRef }> {
  const result: Array<{ config: PDAConfig; via: RuleRef }> = [];
  for (const m of g.moves.get(c.state) ?? []) {
    if (!c.stack.startsWith(m.pop)) continue;
    let remaining = c.remaining;
    if (m.read !== EPSILON) {
      if (!remaining.startsWith(m.read)) continue;
      remaining = remaining.slice(m.read.length);
    }
    result.push({
      config: { state: m.to, remaining, stack: m.push + c.stack.slice(m.pop.length) },
      via: m.via,
    });
  }
  return result;
}

/**
 * IDs já vistas: estado → tamanho do que falta ler → pilhas. A pilha entra
 * no Set como o próprio texto guardado na árvore (sem cópia).
 */
class Visited {
  private readonly seen = new Map<StateId, Map<number, Set<string>>>();

  /** false se a ID já tinha sido vista. */
  add(c: PDAConfig): boolean {
    let byRemaining = this.seen.get(c.state);
    if (!byRemaining) {
      byRemaining = new Map();
      this.seen.set(c.state, byRemaining);
    }
    let stacks = byRemaining.get(c.remaining.length);
    if (!stacks) {
      stacks = new Set();
      byRemaining.set(c.remaining.length, stacks);
    }
    if (stacks.has(c.stack)) return false;
    stacks.add(c.stack);
    return true;
  }
}

/** Nó que leu MAIS da palavra (menos `remaining`); empate: o primeiro da busca. */
function readMost(tree: PDAIDNode[]): number {
  let best = 0;
  for (const n of tree) {
    if (n.config.remaining.length < tree[best]!.config.remaining.length) best = n.index;
  }
  return best;
}

/** Índices da raiz até `index`. */
export function pathTo(tree: ReadonlyArray<{ parent: number | null }>, index: number): number[] {
  const path: number[] = [];
  for (let i: number | null = index; i !== null; i = tree[i]!.parent) path.push(i);
  return path.reverse();
}

/** Limite de nós: inteiro ≥ 1 (padrão quando omitido ou inválido). */
export function limit(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.floor(value));
}
