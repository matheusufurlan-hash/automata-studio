/**
 * Propriedades em APs ALEATÓRIOS (semente fixa) e pureza das funções.
 * A referência `refAccepts` é escrita de outro jeito (conjunto de
 * configurações, direto na lista de transições), para não esconder um erro
 * igual dos dois lados.
 */
import type { PDA, PDAAcceptance, PDASimulationResult } from './types';
import { EPSILON } from './types';
import {
  accepts,
  classify,
  formalDefinition,
  formatConfig,
  inputAlphabet,
  simulate,
  stackAlphabet,
  toEmptyStack,
  toFinalState,
  validate,
} from './index';
import { PDA_EXAMPLES } from './examples';
import { allWords } from './test-helpers';

const WORDS = allWords(['a', 'b'], 4);
const GAMMA = ['Z', 'A', 'B'];

/**
 * Simulação de referência: busca no conjunto de configurações (q, i, γ),
 * com teto de altura da pilha e de configurações. undefined = não deu para
 * decidir dentro dos tetos.
 */
function refAccepts(p: PDA, word: string): boolean | undefined {
  const initial = p.states.find((s) => s.initial);
  if (!initial) return false;
  const finals = new Set(p.states.filter((s) => s.final).map((s) => s.id));
  const chars = Array.from(word);
  let truncated = false;
  const seen = new Set<string>();
  const queue: Array<[string, number, string]> = [[initial.id, 0, p.startStackSymbol]];
  seen.add(JSON.stringify(queue[0]));
  while (queue.length > 0) {
    const [q, i, stack] = queue.shift()!;
    if (i === chars.length && (p.acceptance === 'FINAL_STATE' ? finals.has(q) : stack === '')) return true;
    for (const t of p.transitions) {
      if (t.from !== q) continue;
      for (const r of t.rules) {
        if (stack === '' || stack[0] !== r.pop) continue;
        let j = i;
        if (r.read !== EPSILON) {
          if (chars[i] !== r.read) continue;
          j = i + 1;
        }
        const next = r.push + stack.slice(1);
        if (next.length > 14) {
          truncated = true;
          continue;
        }
        const key = JSON.stringify([t.to, j, next]);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > 20000) return undefined;
        queue.push([t.to, j, next]);
      }
    }
  }
  return truncated ? undefined : false;
}

/** Gerador pseudoaleatório com semente (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPDA(random: () => number): PDA {
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)]!;
  const n = 1 + Math.floor(random() * 4);
  const states = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `s${i}`,
    initial: i === 0,
    final: random() < 0.35,
  }));
  const transitions: PDA['transitions'] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (random() > 0.45) continue;
      const count = 1 + Math.floor(random() * 3);
      const rules = Array.from({ length: count }, () => ({
        read: pick(['a', 'b', EPSILON]),
        pop: pick(GAMMA),
        push: Array.from({ length: Math.floor(random() * 3) }, () => pick(GAMMA)).join(''),
      }));
      transitions.push({ id: `t${transitions.length}`, from: `s${i}`, to: `s${j}`, rules });
    }
  }
  const acceptance: PDAAcceptance = random() < 0.5 ? 'FINAL_STATE' : 'EMPTY_STACK';
  return { states, transitions, startStackSymbol: 'Z', acceptance };
}

/**
 * Invariantes da árvore de IDs (busca em largura). Devolve a lista de
 * problemas (vazia = tudo certo): um expect por nó deixaria o teste lento.
 */
function treeProblems(p: PDA, r: PDASimulationResult): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  };
  const { tree } = r;
  const finals = new Set(p.states.filter((s) => s.final).map((s) => s.id));
  const byId = new Map(p.transitions.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let firstAccepting = -1;
  tree.forEach((n, i) => {
    const at = `nó ${i} ${formatConfig(p, n.config)}`;
    check(n.index === i, `${at}: index`);
    const key = JSON.stringify(n.config);
    if (n.parent === null) {
      check(i === 0 && n.depth === 0 && n.via === null, `${at}: raiz`);
    } else {
      const parent = tree[n.parent]!;
      check(n.parent < i && parent.children.includes(i), `${at}: pai`);
      check(n.depth === parent.depth + 1, `${at}: profundidade`);
      check(parent.status === 'EXPANDED', `${at}: pai não expandido`);
      // a regra usada existe e produz esta ID a partir do pai
      const t = byId.get(n.via!.transition)!;
      const rule = t.rules[n.via!.rule]!;
      const read = rule.read === EPSILON ? '' : rule.read;
      check(
        t.from === parent.config.state &&
          t.to === n.config.state &&
          parent.config.stack.startsWith(rule.pop) &&
          n.config.stack === rule.push + parent.config.stack.slice(1) &&
          parent.config.remaining === read + n.config.remaining,
        `${at}: regra ${n.via!.transition}:${n.via!.rule}`,
      );
    }
    if (i > 0) check(n.depth >= tree[i - 1]!.depth, `${at}: fora da ordem da busca em largura`);
    check((n.status === 'EXPANDED') === n.children.length > 0, `${at}: EXPANDED sem filhos`);
    const accepting =
      n.config.remaining === '' && (p.acceptance === 'EMPTY_STACK' ? n.config.stack === '' : finals.has(n.config.state));
    if (n.status === 'REPEATED') {
      check(seen.has(key), `${at}: REPEATED sem a ID antes`);
    } else {
      check(!seen.has(key), `${at}: ID repetida sem REPEATED`);
      seen.add(key);
      check((n.status === 'ACCEPTING') === accepting, `${at}: ACCEPTING`);
      if (accepting && firstAccepting < 0) firstAccepting = i;
    }
  });
  check(r.accepted === firstAccepting >= 0, 'accepted');
  if (r.accepted) check(r.path.at(-1) === firstAccepting, 'caminho até a 1ª ID que aceita');
  r.path.forEach((index, k) => {
    check(tree[index]!.parent === (k === 0 ? null : r.path[k - 1]), `caminho: passo ${k}`);
  });
  return problems;
}

const random = rng(20261105);
const RANDOM = Array.from({ length: 150 }, () => randomPDA(random));
/** Limite menor que o padrão: alguns APs aleatórios explodem (ciclos de ε que empilham). */
const OPTS = { maxNodes: 1500 };

describe('propriedades em 150 APs aleatórios', () => {
  // quantos pares (AP, palavra) foram de fato comparados com a referência
  let compared = 0;
  afterAll(() => {
    expect(compared).toBeGreaterThan(0.85 * RANDOM.length * WORDS.length);
  });

  it.each(RANDOM.map((p, i) => [i, p] as const))('#%i', (_i, p) => {
    const converted = [toEmptyStack(p), toFinalState(p)];
    for (const w of WORDS) {
      const r = simulate(p, w, OPTS);
      expect(treeProblems(p, r), w).toEqual([]);
      if (r.limitReached) continue;
      const ref = refAccepts(p, w);
      if (ref === undefined) continue;
      compared++;
      expect(r.accepted, w).toBe(ref);
      expect(accepts(p, w)).toBe(ref);
      for (const c of converted) {
        const rc = simulate(c, w, OPTS);
        if (!rc.limitReached) expect(rc.accepted, `${c.acceptance} ${w}`).toBe(ref);
      }
    }
    // DPDA = no máximo um movimento possível em cada ID
    if (classify(p) === 'DPDA') {
      for (const w of WORDS.slice(0, 15)) {
        const r = simulate(p, w, { ...OPTS, exploreAll: true });
        expect(r.tree.every((n) => n.children.length <= 1), w).toBe(true);
      }
    }
  });
});

/** Congela o objeto inteiro: qualquer escrita vira erro (módulos são strict). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe('pureza: nenhuma função modifica a entrada', () => {
  it.each(PDA_EXAMPLES.map((e) => [e.id, e.pda] as const))('%s', (_id, original) => {
    const before = structuredClone(original);
    const p = deepFreeze(structuredClone(original));
    inputAlphabet(p);
    stackAlphabet(p);
    validate(p);
    classify(p);
    simulate(p, '0101');
    simulate(p, 'abc', { exploreAll: true });
    accepts(p, '');
    formalDefinition(p);
    formatConfig(p, { state: p.states[0]!.id, remaining: '', stack: '' });
    toEmptyStack(p);
    toFinalState(p);
    toFinalState(toEmptyStack(p));
    expect(p).toEqual(before);
  });

  it('resultados não compartilham objetos com a entrada', () => {
    const p = PDA_EXAMPLES[0]!.pda;
    for (const c of [toEmptyStack(p), toFinalState(p)]) {
      expect(c.states[0]).not.toBe(p.states[0]);
      expect(c.transitions[0]).not.toBe(p.transitions[0]);
      expect(c.transitions[0]!.rules[0]).not.toBe(p.transitions[0]!.rules[0]);
    }
    const r = simulate(p, '00');
    expect(r.tree[0]!.config).not.toBe(r.tree[1]!.config);
  });
});
