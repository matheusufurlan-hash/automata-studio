/**
 * Simulação da MT (Hopcroft, cap. 8): fita infinita para os dois lados.
 *
 * DTM (classify ≠ 'NTM'): passo a passo, EXATAMENTE UMA regra por passo.
 *  - FINAL_STATE: aceita assim que entra num estado final (se o inicial é
 *    final, aceita com zero passos); se nenhuma regra se aplica fora de um
 *    final, para e rejeita (HALTED).
 *  - HALT: os finais não importam; aceita quando nenhuma regra se aplica.
 *  - configuração repetida (estado + posição absoluta da cabeça + fita) →
 *    LOOP, com `loopStart` = 1ª vez que ela apareceu (certamente não para);
 *  - mais de `maxSteps` passos → STEP_LIMIT (ainda não se sabe). Não há
 *    limite fixo como os 4000 do YAAS.
 *
 * NTM: busca em largura na árvore de IDs, como no AP (REPEATED, expansão
 * tudo-ou-nada dentro de `maxNodes`, para na 1ª ID que aceita — a mais
 * rasa; com `exploreAll`, continua até montar a árvore inteira, e o caminho
 * continua sendo o da 1ª ID que aceitou). `limitReached` diz se a busca
 * parou no limite. Em HALT, uma ID sem regra aplicável aceita. Se a busca termina
 * sem aceitar, é LOOP quando algum ramo entra em ciclo (há ciclo no grafo
 * das configurações, contando as IDs REPEATED) e HALTED quando todos os
 * ramos param. `steps` = caminho até a ID que aceitou ou, se não aceitou,
 * até a ID mais funda (empate: a primeira da busca).
 *
 * `tree` vem sempre que a TM é NTM: [] sem estado inicial e só a raiz
 * quando a palavra é recusada antes de rodar (branco ou símbolo fora de Σ).
 *
 * Salvaguarda de memória: se as fitas guardadas (passos ou árvore) somarem
 * mais de MAX_TAPE_SYMBOLS células, a simulação para como STEP_LIMIT. Com
 * os limites padrão isso nunca acontece (a fita cresce no máximo uma célula
 * por passo).
 */
import { TM_DEFAULT_MAX_NODES, TM_DEFAULT_MAX_STEPS } from './types';
import type { TM, TMConfig, TMIDNode, TMSimulateOptions, TMSimulationResult, TMStep } from './types';
import { buildGraph, isDeterministic, movesOf, Tape, tapeOutput, type Graph, type Move } from './internal';

/** Soma máxima do tamanho das fitas guardadas (salvaguarda de memória). */
export const MAX_TAPE_SYMBOLS = 64_000_000;

export function simulate(tm: TM, word: string, opts: TMSimulateOptions = {}): TMSimulationResult {
  const g = buildGraph(tm);
  const acceptance = tm.acceptance;
  const ntm = !isDeterministic(g);

  if (g.initial === null) {
    return { accepted: false, acceptance, stop: 'NO_INITIAL_STATE', steps: [], ...(ntm ? { tree: [] } : {}) };
  }

  const input = Array.from(word);
  const start = new Tape(input, g.blank).config(g.initial, 0);
  const sigma = new Set(g.sigma);
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    const stop = c === g.blank ? 'BLANK_IN_INPUT' : !g.sigmaGuessed && !sigma.has(c) ? 'SYMBOL_NOT_IN_ALPHABET' : null;
    if (stop) {
      const result: TMSimulationResult = {
        accepted: false,
        acceptance,
        stop,
        steps: [{ index: 0, config: start, via: null }],
        stoppedAt: i,
      };
      if (ntm) result.tree = [rootNode(start)];
      return result;
    }
  }

  return ntm
    ? simulateNTM(g, tm, start, limit(opts.maxNodes, TM_DEFAULT_MAX_NODES, 1), opts.exploreAll === true)
    : simulateDTM(g, tm, input, start, limit(opts.maxSteps, TM_DEFAULT_MAX_STEPS, 0));
}

function simulateDTM(g: Graph, tm: TM, input: string[], start: TMConfig, maxSteps: number): TMSimulationResult {
  const acceptance = tm.acceptance;
  const steps: TMStep[] = [{ index: 0, config: start, via: null }];
  const finish = (stop: TMSimulationResult['stop'], accepted: boolean): TMSimulationResult => {
    const result: TMSimulationResult = { accepted, acceptance, stop, steps };
    if (stop === 'ACCEPTED_FINAL' || stop === 'HALTED') result.output = tapeOutput(steps.at(-1)!.config, g.blank);
    return result;
  };

  if (acceptance === 'FINAL_STATE' && g.finals.has(start.state)) return finish('ACCEPTED_FINAL', true);

  const tape = new Tape(input, g.blank);
  const seen = new Seen();
  seen.add(start, 0);
  let state = start.state;
  let head = 0;
  let stored = start.tape.length;
  for (;;) {
    const move = movesOf(g, state, tape.get(head))[0];
    if (!move) return finish('HALTED', acceptance === 'HALT');
    if (steps.length - 1 >= maxSteps) return finish('STEP_LIMIT', false);
    if (stored > MAX_TAPE_SYMBOLS) return { ...finish('STEP_LIMIT', false), memoryLimit: true };

    tape.set(head, move.write);
    head += move.move === 'R' ? 1 : -1;
    state = move.to;
    const config = tape.config(state, head);
    stored += config.tape.length;
    steps.push({ index: steps.length, config, via: move.via });

    if (acceptance === 'FINAL_STATE' && g.finals.has(state)) return finish('ACCEPTED_FINAL', true);
    const first = seen.get(config);
    if (first !== undefined) return { ...finish('LOOP', false), loopStart: first };
    seen.add(config, steps.length - 1);
  }
}

function simulateNTM(g: Graph, tm: TM, start: TMConfig, maxNodes: number, exploreAll: boolean): TMSimulationResult {
  const acceptance = tm.acceptance;
  const root = rootNode(start);
  const tree: TMIDNode[] = [root];
  const halts = (c: TMConfig) => movesOf(g, c.state, symbolAt(c)).length === 0;
  const accepting = (c: TMConfig) => (acceptance === 'FINAL_STATE' ? g.finals.has(c.state) : halts(c));

  let firstAccepting = -1;
  let limitReached = false;
  let memoryLimit = false;
  const seen = new Seen();
  /** Para cada REPEATED: o índice da 1ª vez que a ID apareceu. */
  const firstOf = new Map<number, number>();

  if (accepting(start)) {
    root.status = 'ACCEPTING';
    firstAccepting = 0;
  } else {
    seen.add(start, 0);
    let stored = start.tape.length;
    const queue: number[] = [0];
    for (let head = 0; head < queue.length; head++) {
      const node = tree[queue[head]!]!;
      const next = successors(g, node.config);
      if (next.length === 0) {
        node.status = 'DEAD';
        continue;
      }
      const extra = next.reduce((sum, s) => sum + s.config.tape.length, 0);
      if (tree.length + next.length > maxNodes || stored + extra > MAX_TAPE_SYMBOLS) {
        limitReached = true;
        memoryLimit = tree.length + next.length <= maxNodes;
        break;
      }
      stored += extra;
      node.status = 'EXPANDED';
      for (const { config, via } of next) {
        const child: TMIDNode = {
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
        const first = seen.get(config);
        if (first !== undefined) {
          child.status = 'REPEATED';
          firstOf.set(child.index, first);
        } else {
          seen.add(config, child.index);
          if (accepting(config)) {
            child.status = 'ACCEPTING';
            if (firstAccepting < 0) firstAccepting = child.index;
          } else {
            queue.push(child.index);
          }
        }
      }
      if (firstAccepting >= 0 && !exploreAll) break;
    }
  }

  const accepted = firstAccepting >= 0;
  const target = accepted ? firstAccepting : deepest(tree);
  const steps: TMStep[] = pathTo(tree, target).map((i) => ({
    index: tree[i]!.depth,
    config: tree[i]!.config,
    via: tree[i]!.via,
  }));
  const stop: TMSimulationResult['stop'] = accepted
    ? acceptance === 'FINAL_STATE'
      ? 'ACCEPTED_FINAL'
      : 'HALTED'
    : limitReached
      ? 'STEP_LIMIT'
      : hasCycle(tree, firstOf)
        ? 'LOOP'
        : 'HALTED';
  const result: TMSimulationResult = { accepted, acceptance, stop, steps, tree, limitReached };
  if (memoryLimit) result.memoryLimit = true;
  if (stop === 'ACCEPTED_FINAL' || stop === 'HALTED') result.output = tapeOutput(steps.at(-1)!.config, g.blank);
  return result;
}

/** IDs filhas: uma por movimento de (q, símbolo sob a cabeça), na ordem das transições e das regras. */
function successors(g: Graph, c: TMConfig): Array<{ config: TMConfig; via: Move['via'] }> {
  return movesOf(g, c.state, symbolAt(c)).map((m) => {
    const tape = new Tape(Array.from(c.tape), g.blank);
    tape.set(c.head, m.write);
    const config = tape.config(m.to, c.head + (m.move === 'R' ? 1 : -1));
    config.origin += c.origin;
    return { config, via: m.via };
  });
}

function symbolAt(c: TMConfig): string {
  return Array.from(c.tape)[c.head]!;
}

function rootNode(config: TMConfig): TMIDNode {
  return { index: 0, parent: null, children: [], config, via: null, depth: 0, status: 'UNEXPLORED' };
}

/**
 * Configurações já vistas: (estado, origem, cabeça) → fita → índice. A fita
 * entra no Map como o próprio texto guardado no passo/nó (sem cópia).
 */
class Seen {
  private readonly map = new Map<string, Map<string, number>>();

  private static key(c: TMConfig): string {
    return `${c.origin}\u0000${c.head}\u0000${c.state}`;
  }

  get(c: TMConfig): number | undefined {
    return this.map.get(Seen.key(c))?.get(c.tape);
  }

  add(c: TMConfig, index: number): void {
    const key = Seen.key(c);
    let byTape = this.map.get(key);
    if (!byTape) {
      byTape = new Map();
      this.map.set(key, byTape);
    }
    byTape.set(c.tape, index);
  }
}

/** Nó mais fundo; empate: o primeiro da busca em largura. */
function deepest(tree: TMIDNode[]): number {
  let best = 0;
  for (const n of tree) if (n.depth > tree[best]!.depth) best = n.index;
  return best;
}

/** Índices da raiz até `index`. */
function pathTo(tree: TMIDNode[], index: number): number[] {
  const path: number[] = [];
  for (let i: number | null = index; i !== null; i = tree[i]!.parent) path.push(i);
  return path.reverse();
}

/**
 * Há ciclo no grafo das configurações? Vértices = nós não REPEATED; arestas =
 * pai → filho, com o filho REPEATED trocado pela 1ª vez que a ID apareceu.
 */
function hasCycle(tree: TMIDNode[], firstOf: Map<number, number>): boolean {
  const target = (i: number) => firstOf.get(i) ?? i;
  const color = new Uint8Array(tree.length); // 0 = branco, 1 = na pilha, 2 = pronto
  for (const start of tree) {
    if (firstOf.has(start.index) || color[start.index] !== 0) continue;
    const stack: Array<[number, number]> = [[start.index, 0]];
    color[start.index] = 1;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const node = tree[top[0]]!;
      if (top[1] < node.children.length) {
        const next = target(node.children[top[1]++]!);
        if (color[next] === 1) return true;
        if (color[next] === 0) {
          color[next] = 1;
          stack.push([next, 0]);
        }
      } else {
        color[node.index] = 2;
        stack.pop();
      }
    }
  }
  return false;
}

/** Limite: inteiro ≥ `min` (padrão quando omitido ou inválido). */
function limit(value: number | undefined, fallback: number, min: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.floor(value));
}
