/**
 * Testes de revisão.
 *
 *  - `it(...)`: propriedades que o revisor conferiu e que PASSAM (ficam como
 *    rede de segurança, com autômatos aleatórios diferentes dos exemplos:
 *    nomes ≠ ids, 0/1/2 iniciais, pares (from,to) repetidos, Σ = {a,b,c}).
 *  - `it.fails(...)`: demonstram um problema encontrado na revisão.
 *    Quando o problema for corrigido, o teste passa a "falhar" (it.fails) e
 *    deve virar `it` normal.
 *
 * A referência ingênua aqui NÃO usa nada do núcleo: busca em profundidade
 * sobre (estado, posição na palavra), com o fecho-ε feito pelo próprio caminho.
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
} from './index';
import { FA_EXAMPLES } from './examples';

/* ------------------------------------------------------------------ */
/* Referência ingênua                                                  */
/* ------------------------------------------------------------------ */

/** Aceita se existe um caminho (com ε) do inicial a um final lendo `word`. */
function naiveAccepts(fa: FA, word: string): boolean {
  const ids = new Set(fa.states.map((s) => s.id));
  const finals = new Set(fa.states.filter((s) => s.final).map((s) => s.id));
  const chars = Array.from(word);
  const seen = new Set<string>();
  const dfs = (state: string, pos: number): boolean => {
    const key = `${state}@${pos}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (pos === chars.length && finals.has(state)) return true;
    for (const t of fa.transitions) {
      if (t.from !== state || !ids.has(t.to)) continue;
      if (t.symbols.includes(EPSILON) && dfs(t.to, pos)) return true;
      if (pos < chars.length && t.symbols.includes(chars[pos]!) && dfs(t.to, pos + 1)) return true;
    }
    return false;
  };
  return fa.states.some((s) => s.initial && ids.has(s.id) && dfs(s.id, 0));
}

function words(sigma: Sym[], maxLength: number): string[] {
  const out = [''];
  let layer = [''];
  for (let n = 1; n <= maxLength; n++) {
    layer = layer.flatMap((w) => sigma.map((c) => w + c));
    out.push(...layer);
  }
  return out;
}

/** xorshift32 com semente: gera sempre os mesmos autômatos. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * Autômato aleatório "como o aluno desenha": ids `n0..` e nomes `q0..` (ids ≠
 * nomes!), às vezes sem inicial ou com 2 iniciais, às vezes com par (from,to)
 * repetido (o contrato diz que o núcleo tem que aceitar).
 */
function randomFA(random: () => number, sigma: Sym[], maxStates: number, idPrefix = 'n'): FA {
  const n = 1 + Math.floor(random() * maxStates);
  const roll = random();
  const initials = roll < 0.06 ? [] : roll < 0.12 && n > 1 ? [0, n - 1] : [Math.floor(random() * n)];
  const states = Array.from({ length: n }, (_, i) => ({
    id: `${idPrefix}${i}`,
    name: `q${i}`,
    initial: initials.includes(i),
    final: random() < 0.35,
  }));
  const transitions: FA['transitions'] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (random() > 0.45) continue;
      const symbols = [...sigma, EPSILON].filter((s) => random() < (s === EPSILON ? 0.15 : 0.45));
      if (symbols.length === 0) continue;
      transitions.push({ id: `${idPrefix}t${transitions.length}`, from: `${idPrefix}${i}`, to: `${idPrefix}${j}`, symbols });
      if (random() < 0.05) {
        // par repetido
        transitions.push({ id: `${idPrefix}t${transitions.length}`, from: `${idPrefix}${i}`, to: `${idPrefix}${j}`, symbols: [sigma[0]!] });
      }
    }
  }
  return { states, transitions };
}

const SIGMA2: Sym[] = ['a', 'b'];
const SIGMA3: Sym[] = ['a', 'b', 'c'];
const W2 = words(SIGMA2, 5);
const W3 = words(SIGMA3, 4);

const r2 = rng(4242);
const SMALL = Array.from({ length: 200 }, () => randomFA(r2, SIGMA2, 5));
const r3 = rng(777);
const BIGGER = Array.from({ length: 80 }, () => randomFA(r3, SIGMA3, 6));

/** Nº de estados do AFD mínimo COMPLETO, por Myhill–Nerode ingênuo (assinaturas). */
function minimalCompleteSize(fa: FA, sigma: Sym[], probeLength: number, prefixLength: number): number {
  const probes = words(sigma, probeLength);
  const signatures = new Set<string>();
  for (const p of words(sigma, prefixLength)) {
    signatures.add(probes.map((s) => (naiveAccepts(fa, p + s) ? '1' : '0')).join(''));
  }
  return signatures.size;
}

/* ------------------------------------------------------------------ */
/* Propriedades (passam)                                               */
/* ------------------------------------------------------------------ */

describe('revisor: 200 AFs aleatórios (≤5 estados, Σ={a,b}, nomes ≠ ids)', () => {
  it.each(SMALL.map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    const lang = W2.map((w) => naiveAccepts(a, w));
    const same = (x: FA) => expect(W2.map((w) => accepts(x, w))).toEqual(lang);

    same(a);
    expect(W2.map((w) => simulate(a, w).accepted)).toEqual(lang);
    const d = determinize(a);
    expect(classify(d.dfa)).toBe('DFA');
    same(d.dfa);
    const m = minimize(a);
    same(m.dfa);
    expect(equivalent(a, d.dfa).equivalent).toBe(true);
    expect(equivalent(a, m.dfa).equivalent).toBe(true);
    expect(equivalent(d.dfa, m.dfa).equivalent).toBe(true);
    expect(minimize(m.dfa).dfa.states.length).toBe(m.dfa.states.length);
    // nº de estados do mínimo = nº de classes de Myhill–Nerode (com estado morto).
    // Com k estados, prefixos até k-1 alcançam tudo e sufixos até k-2 separam tudo.
    const k = m.dfa.states.length;
    if (alphabet(a).length === 2 && k <= 9) {
      expect(k).toBe(minimalCompleteSize(a, SIGMA2, Math.max(k - 2, 0), k - 1));
    }
    same(removeUnreachable(a));
    same(removeUseless(a));
    same(complete(a, SIGMA2));
    expect(W2.map((w) => accepts(complement(a, SIGMA2), w))).toEqual(lang.map((x) => !x));
  });
});

describe('revisor: 80 AFs aleatórios (≤6 estados, Σ={a,b,c})', () => {
  it.each(BIGGER.map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    const lang = W3.map((w) => naiveAccepts(a, w));
    expect(W3.map((w) => accepts(a, w))).toEqual(lang);
    expect(W3.map((w) => accepts(determinize(a).dfa, w))).toEqual(lang);
    expect(W3.map((w) => accepts(minimize(a).dfa, w))).toEqual(lang);
    expect(W3.map((w) => accepts(complement(a, SIGMA3), w))).toEqual(lang.map((x) => !x));
    expect(equivalent(a, minimize(a).dfa).equivalent).toBe(true);
  });
});

describe('revisor: operações binárias com ids IGUAIS nos dois autômatos', () => {
  const r = rng(99);
  const pairs = Array.from({ length: 80 }, () => [randomFA(r, SIGMA2, 4, 'n'), randomFA(r, SIGMA2, 4, 'n')] as const);
  const W = words(SIGMA2, 4);
  it.each(pairs.map((p, i) => [i, ...p] as const))('par #%i', (_i, a, b) => {
    const inA = (w: string) => naiveAccepts(a, w);
    const inB = (w: string) => naiveAccepts(b, w);
    const splits = (w: string, f: (x: string, y: string) => boolean) =>
      Array.from({ length: w.length + 1 }, (_, k) => k).some((k) => f(w.slice(0, k), w.slice(k)));
    const inStar = (w: string): boolean =>
      w === '' || Array.from({ length: w.length }, (_, k) => k + 1).some((k) => inA(w.slice(0, k)) && inStar(w.slice(k)));
    for (const w of W) {
      expect(accepts(union(a, b), w)).toBe(inA(w) || inB(w));
      expect(accepts(intersection(a, b), w)).toBe(inA(w) && inB(w));
      expect(accepts(concat(a, b), w)).toBe(splits(w, (x, y) => inA(x) && inB(y)));
      expect(accepts(star(a), w)).toBe(inStar(w));
    }
    // menor contraexemplo (tamanho, depois ordem alfabética)
    const eq = equivalent(a, b);
    const first = words(SIGMA2, 7).find((w) => inA(w) !== inB(w));
    if (first !== undefined) expect(eq).toEqual({ equivalent: false, counterexample: first });
    else expect(eq.equivalent).toBe(true);
  });
});

describe('revisor: invariantes de simulate (passos, viaEpsilon, usedTransitions)', () => {
  it.each(SMALL.slice(0, 120).map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    for (const w of [...words(SIGMA2, 3), 'abc', 'ca']) {
      const r = simulate(a, w);
      const tids = new Set(a.transitions.map((t) => t.id));
      if (!a.states.some((s) => s.initial)) {
        expect(r).toEqual({ accepted: false, steps: [], reason: 'NO_INITIAL_STATE' });
        continue;
      }
      expect(r.steps[0]!.read).toBeNull();
      r.steps.forEach((s, k) => {
        expect(s.index).toBe(k);
        expect(s.consumed + s.remaining).toBe(w);
        expect(s.consumed.length).toBe(k);
        for (const v of s.viaEpsilon) expect(s.active).toContain(v);
        for (const t of s.usedTransitions) expect(tids.has(t)).toBe(true);
        // ativos = ECLOSE(δ(ativos anteriores, símbolo))
        if (k > 0 && s.active.length > 0) {
          const prev = new Set(r.steps[k - 1]!.active);
          const direct = new Set(
            a.transitions.filter((t) => prev.has(t.from) && t.symbols.includes(s.read!)).map((t) => t.to),
          );
          expect([...s.active].sort()).toEqual([...eclose(a, [...direct])].sort());
          // quem chegou lendo o símbolo NÃO é viaEpsilon
          for (const d of direct) expect(s.viaEpsilon).not.toContain(d);
        }
      });
      if (r.accepted) expect(r.reason).toBeUndefined();
      if (r.reason === 'DEAD_END') {
        expect(r.steps.at(-1)!.active).toEqual([]);
        expect(r.stoppedAt).toBe(r.steps.length - 2);
      }
      if (r.reason === 'SYMBOL_NOT_IN_ALPHABET') {
        expect(alphabet(a)).not.toContain(Array.from(w)[r.stoppedAt!]);
      }
      if (r.reason === 'ENDED_IN_NON_FINAL') {
        expect(r.steps).toHaveLength(Array.from(w).length + 1);
      }
    }
  });
});

describe('revisor: tabela de minimização é coerente com a teoria', () => {
  const all = [...SMALL.slice(0, 100), ...FA_EXAMPLES.map((e) => e.fa)];
  it.each(all.map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    const m = minimize(a);
    const input = m.input;
    const sigma = alphabet(a);
    expect(classify(input)).toBe('DFA');
    const initial = input.states.find((s) => s.initial)!.id;
    const finals = new Set(input.states.filter((s) => s.final).map((s) => s.id));
    const step = (s: string, c: string) => input.transitions.find((t) => t.from === s && t.symbols.includes(c))!.to;
    // completo e tudo alcançável
    for (const s of input.states) for (const c of sigma) expect(() => step(s.id, c)).not.toThrow();
    const reach = new Set([initial]);
    for (const x of reach) for (const c of sigma) reach.add(step(x, c));
    expect(reach.size).toBe(input.states.length);

    const markedIn = new Map<string, number>();
    const pk = (p: string, q: string) => [p, q].sort().join('|');
    for (const round of m.table.rounds) {
      for (const mp of round.newlyMarked) {
        const [p, q] = mp.pair;
        expect(markedIn.has(pk(p, q))).toBe(false); // cada par só é marcado uma vez
        // o par está na ordem da tabela (o primeiro vem antes na `order`)
        expect(m.table.order.indexOf(p)).toBeLessThan(m.table.order.indexOf(q));
        if (round.round === 0) {
          expect(finals.has(p)).not.toBe(finals.has(q));
          expect(mp.symbol).toBeNull();
          expect(mp.because).toBeNull();
        } else {
          expect(mp.symbol).not.toBeNull();
          const [x, y] = mp.because!;
          expect(pk(x, y)).toBe(pk(step(p, mp.symbol!), step(q, mp.symbol!)));
          // `because` foi marcado numa rodada ANTERIOR
          expect(markedIn.get(pk(x, y))).toBeLessThan(round.round);
        }
        markedIn.set(pk(p, q), round.round);
      }
    }
    // rodada k marca exatamente os pares cuja MENOR palavra que separa tem tamanho k
    const ids = m.table.order;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p = ids[i]!;
        const q = ids[j]!;
        // BFS no produto: distância até um par (x,y) com finalidade diferente
        let shortest: number | null = null;
        const seenPairs = new Set([`${p}|${q}`]);
        let frontier: Array<[string, string]> = [[p, q]];
        for (let len = 0; frontier.length > 0 && shortest === null; len++) {
          if (frontier.some(([x, y]) => finals.has(x) !== finals.has(y))) {
            shortest = len;
            break;
          }
          const next: Array<[string, string]> = [];
          for (const [x, y] of frontier) {
            for (const c of sigma) {
              const pair: [string, string] = [step(x, c), step(y, c)];
              if (!seenPairs.has(pair.join('|'))) {
                seenPairs.add(pair.join('|'));
                next.push(pair);
              }
            }
          }
          frontier = next;
        }
        expect(markedIn.get(pk(p, q)) ?? null).toBe(shortest);
      }
    }
    // grupos = partição de input; merged coerente com os grupos
    expect(m.table.groups.flat().sort()).toEqual(input.states.map((s) => s.id).sort());
    expect(Object.values(m.merged).map((g) => [...g].sort().join(',')).sort()).toEqual(
      m.table.groups.map((g) => [...g].sort().join(',')).sort(),
    );
    expect(Object.keys(m.merged).sort()).toEqual(m.dfa.states.map((s) => s.id).sort());
  });
});

describe('revisor: determinize.subsets coerente com a construção de subconjuntos', () => {
  it.each(SMALL.slice(0, 100).map((a, i) => [i, a] as const))('#%i', (_i, a) => {
    const { dfa, subsets } = determinize(a);
    const finals = new Set(a.states.filter((s) => s.final).map((s) => s.id));
    const key = (xs: string[]) => [...xs].sort().join(',');
    // um estado por subconjunto, sem repetição
    expect(new Set(Object.values(subsets).map(key)).size).toBe(dfa.states.length);
    const initials = a.states.filter((s) => s.initial).map((s) => s.id);
    const start = dfa.states.find((s) => s.initial)!;
    expect(key(subsets[start.id]!)).toBe(key(eclose(a, initials)));
    for (const s of dfa.states) {
      expect(s.final).toBe(subsets[s.id]!.some((x) => finals.has(x)));
      for (const c of alphabet(a)) {
        const t = dfa.transitions.find((x) => x.from === s.id && x.symbols.includes(c));
        const moved = a.transitions.filter((x) => subsets[s.id]!.includes(x.from) && x.symbols.includes(c)).map((x) => x.to);
        expect(key(subsets[t!.to]!)).toBe(key(eclose(a, moved)));
      }
    }
    // nomes únicos
    expect(new Set(dfa.states.map((s) => s.name)).size).toBe(dfa.states.length);
  });
});

describe('revisor: casos de borda', () => {
  it('determinize: ciclo ε q0⇄q1, inicial final, palavra vazia', () => {
    const a: FA = {
      states: [
        { id: 'x', name: 'q0', initial: true, final: true },
        { id: 'y', name: 'q1', initial: false, final: false },
        { id: 'z', name: 'q2', initial: false, final: false },
      ],
      transitions: [
        { id: 't0', from: 'x', to: 'y', symbols: [EPSILON] },
        { id: 't1', from: 'y', to: 'x', symbols: [EPSILON] },
        { id: 't2', from: 'y', to: 'z', symbols: ['a'] },
        { id: 't3', from: 'z', to: 'z', symbols: [EPSILON, 'b'] },
      ],
    };
    const { dfa, subsets } = determinize(a);
    expect(dfa.states.find((s) => s.initial)).toMatchObject({ name: '{q0,q1}', final: true });
    expect(subsets[dfa.states.find((s) => s.initial)!.id]).toEqual(['x', 'y']);
    expect(accepts(dfa, '')).toBe(true);
    expect(accepts(dfa, 'a')).toBe(false);
  });

  it('minimize: 1 estado só, nenhum final, AFD já mínimo', () => {
    const one: FA = { states: [{ id: 'k', name: 'k', initial: true, final: false }], transitions: [] };
    expect(minimize(one).dfa.states).toHaveLength(1);
    expect(minimize(one).table.rounds).toEqual([{ round: 0, newlyMarked: [] }]);
    const ex = FA_EXAMPLES.find((e) => e.id === 'afd-termina-01')!.fa;
    expect(minimize(ex).dfa.states).toHaveLength(3);
  });

  it('complement com Σ explícito MAIOR que o do autômato aceita palavras com o símbolo novo', () => {
    const ex = FA_EXAMPLES.find((e) => e.id === 'afd-termina-01')!.fa; // Σ = {0,1}
    const c = complement(ex, ['0', '1', '2']);
    expect(accepts(c, '2')).toBe(true);
    expect(accepts(c, '012')).toBe(true);
    expect(accepts(c, '01')).toBe(false);
  });

  it('formalDefinition de um AFD gerado por determinize lista δ completa', () => {
    const ex = FA_EXAMPLES.find((e) => e.id === 'afn-termina-01')!.fa;
    const f = formalDefinition(determinize(ex).dfa);
    expect(f.type).toBe('DFA');
    expect(f.delta).toHaveLength(f.states.length * f.alphabet.length);
  });
});

/* ------------------------------------------------------------------ */
/* Problemas encontrados (it.fails)                                    */
/* ------------------------------------------------------------------ */

describe('revisor: problemas no núcleo', () => {
  /**
   * Revisão — "Minimizar o resultado de determinizar gera nomes aninhados".
   * Já conhecido; o teste mostra o nome real que aparece na tela.
   */
  it('minimize(determinize(AFN)) não deveria gerar nomes aninhados {{…},{…}}', () => {
    const ex = FA_EXAMPLES.find((e) => e.id === 'enfa-numero-decimal')!.fa;
    const m = minimize(determinize(ex).dfa).dfa;
    for (const s of m.states) expect(s.name).not.toMatch(/\{\{/);
  });

  /**
   * Revisão — "classify diz AFD para autômato com 2 estados iniciais".
   * Com 2 iniciais a simulação roda como AFN (os dois começam ativos), mas o
   * selo diz AFD e o menu "AFN → AFD" é tratado como desnecessário.
   */
  it('classify não deveria chamar de AFD um autômato com 2 iniciais', () => {
    const a: FA = {
      states: [
        { id: 'p', name: 'p', initial: true, final: false },
        { id: 'q', name: 'q', initial: true, final: true },
      ],
      transitions: [{ id: 't', from: 'p', to: 'q', symbols: ['a'] }],
    };
    // simula como AFN: aceita ε porque q (inicial) é final
    expect(simulate(a, '').steps[0]!.active).toEqual(['p', 'q']);
    expect(classify(a)).not.toBe('DFA');
  });

  /**
   * Revisão — "Nomes repetidos ficam ambíguos em determinize".
   * Dois estados com o MESMO nome (o arquivo aceita; ver store) geram
   * estados diferentes com o mesmo nome no AFD.
   */
  it('determinize não deveria gerar dois estados com o mesmo nome', () => {
    const a: FA = {
      states: [
        { id: 'a1', name: 'q', initial: true, final: false },
        { id: 'a2', name: 'q', initial: false, final: true },
      ],
      transitions: [
        { id: 't0', from: 'a1', to: 'a2', symbols: ['a'] },
        { id: 't1', from: 'a1', to: 'a1', symbols: ['b'] },
      ],
    };
    const names = determinize(a).dfa.states.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
