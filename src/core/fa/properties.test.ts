/**
 * Propriedades em autômatos ALEATÓRIOS (semente fixa) e pureza das funções.
 * A referência `refAccepts` é escrita de outro jeito (sem o grafo interno),
 * para não esconder um erro igual dos dois lados.
 */
import { EPSILON } from './types';
import type { FA, Sym } from './types';
import {
  accepts,
  alphabet,
  classify,
  complement,
  complete,
  concat,
  determinize,
  eclose,
  equivalent,
  formalDefinition,
  intersection,
  minimize,
  removeUnreachable,
  removeUseless,
  simulate,
  star,
  union,
  validate,
} from './index';
import { FA_EXAMPLES } from './examples';
import { allWords } from './test-helpers';

const SIGMA: Sym[] = ['a', 'b'];
const WORDS = allWords(SIGMA, 5);

/** Simulação de referência: fecho-ε por ponto fixo direto na lista de transições. */
function refAccepts(fa: FA, word: string): boolean {
  const close = (set: Set<string>) => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const t of fa.transitions) {
        if (set.has(t.from) && t.symbols.includes(EPSILON) && !set.has(t.to)) {
          set.add(t.to);
          changed = true;
        }
      }
    }
    return set;
  };
  let current = close(new Set(fa.states.filter((s) => s.initial).map((s) => s.id)));
  for (const c of word) {
    const next = new Set<string>();
    for (const t of fa.transitions) if (current.has(t.from) && t.symbols.includes(c)) next.add(t.to);
    current = close(next);
  }
  return fa.states.some((s) => s.final && current.has(s.id));
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

function randomFA(random: () => number): FA {
  const n = 1 + Math.floor(random() * 5);
  const states = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `s${i}`,
    initial: i === 0,
    final: random() < 0.35,
  }));
  const transitions: FA['transitions'] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (random() > 0.4) continue;
      const symbols = [...SIGMA, EPSILON].filter((s) => random() < (s === EPSILON ? 0.2 : 0.5));
      if (symbols.length > 0) transitions.push({ id: `t${transitions.length}`, from: `s${i}`, to: `s${j}`, symbols });
    }
  }
  return { states, transitions };
}

/** AFD completo: estado depois de ler `word` a partir de `from`. */
function run(dfa: FA, from: string, word: string): string {
  let s = from;
  for (const c of word) s = dfa.transitions.find((t) => t.from === s && t.symbols.includes(c))!.to;
  return s;
}

const random = rng(20261105);
const RANDOM = Array.from({ length: 120 }, () => randomFA(random));

describe('propriedades em 120 autômatos aleatórios', () => {
  it.each(RANDOM.map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    const expected = WORDS.filter((w) => refAccepts(a, w));
    const language = (x: FA) => WORDS.filter((w) => accepts(x, w));

    expect(language(a)).toEqual(expected);
    for (const w of WORDS.slice(0, 15)) expect(simulate(a, w).accepted).toBe(refAccepts(a, w));

    const { dfa } = determinize(a);
    expect(classify(dfa)).toBe('DFA');
    expect(language(dfa)).toEqual(expected);

    const m = minimize(a).dfa;
    expect(language(m)).toEqual(expected);
    expect(minimize(m).dfa.states).toHaveLength(m.states.length);
    // mínimo de verdade: completo, tudo alcançável e todo par distinguível
    const sigma = alphabet(a);
    const initial = m.states.find((s) => s.initial)!.id;
    const reached = new Set(allWords(sigma, m.states.length).map((w) => run(m, initial, w)));
    expect(reached.size).toBe(m.states.length);
    const probes = allWords(sigma, Math.max(m.states.length - 1, 0));
    const finals = new Set(m.states.filter((s) => s.final).map((s) => s.id));
    for (let i = 0; i < m.states.length; i++) {
      for (let j = i + 1; j < m.states.length; j++) {
        const p = m.states[i]!.id;
        const q = m.states[j]!.id;
        expect(probes.some((w) => finals.has(run(m, p, w)) !== finals.has(run(m, q, w)))).toBe(true);
      }
    }

    const c = complement(a, SIGMA);
    expect(language(c)).toEqual(WORDS.filter((w) => !refAccepts(a, w)));
    expect(language(complete(a, SIGMA))).toEqual(expected);
    expect(language(removeUnreachable(a))).toEqual(expected);
    expect(language(removeUseless(a))).toEqual(expected);
    expect(equivalent(a, dfa)).toEqual({ equivalent: true });
    expect(equivalent(a, m)).toEqual({ equivalent: true });
  });

  it.each(RANDOM.slice(0, 60).map((a, i) => [i, a, RANDOM[i + 60]!] as const))('par #%i', (_i, a, b) => {
    const inA = (w: string) => refAccepts(a, w);
    const inB = (w: string) => refAccepts(b, w);
    const language = (x: FA) => WORDS.filter((w) => accepts(x, w));

    expect(language(union(a, b))).toEqual(WORDS.filter((w) => inA(w) || inB(w)));
    expect(language(intersection(a, b))).toEqual(WORDS.filter((w) => inA(w) && inB(w)));
    expect(language(concat(a, b))).toEqual(
      WORDS.filter((w) => Array.from({ length: w.length + 1 }, (_, k) => k).some((k) => inA(w.slice(0, k)) && inB(w.slice(k)))),
    );
    const inStar = (w: string): boolean =>
      w === '' || Array.from({ length: w.length }, (_, k) => k + 1).some((k) => inA(w.slice(0, k)) && inStar(w.slice(k)));
    expect(language(star(a))).toEqual(WORDS.filter(inStar));

    // equivalência: o contraexemplo é a PRIMEIRA palavra (tamanho, depois ordem) que separa
    const r = equivalent(a, b);
    const firstDiff = allWords(SIGMA, 6).find((w) => inA(w) !== inB(w));
    if (r.equivalent) {
      expect(firstDiff).toBeUndefined();
    } else if (firstDiff !== undefined) {
      expect(r.counterexample).toBe(firstDiff);
    } else {
      // separa só com palavra maior que 6: confere que separa mesmo
      expect(inA(r.counterexample!)).not.toBe(inB(r.counterexample!));
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
  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s', (_id, original) => {
    const before = structuredClone(original);
    const a = deepFreeze(structuredClone(original));
    const b = deepFreeze(structuredClone(FA_EXAMPLES[0]!.fa));
    const firstState = a.states[0]!.id;
    alphabet(a);
    validate(a);
    classify(a);
    eclose(a, firstState);
    eclose(a, [firstState]);
    simulate(a, '0101');
    accepts(a, 'ab');
    determinize(a);
    minimize(a);
    complete(a);
    complete(a, ['x']);
    complement(a);
    union(a, b);
    concat(a, b);
    star(a);
    intersection(a, b);
    removeUnreachable(a);
    removeUseless(a);
    formalDefinition(a);
    equivalent(a, b);
    expect(a).toEqual(before);
  });

  it('resultados não compartilham objetos com a entrada', () => {
    const a = FA_EXAMPLES[0]!.fa;
    const c = complete(a);
    expect(c.states[0]).not.toBe(a.states[0]);
    const r = removeUnreachable(a);
    expect(r.transitions[0]).not.toBe(a.transitions[0]);
  });
});
