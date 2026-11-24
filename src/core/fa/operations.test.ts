import type { FA } from './types';
import {
  accepts,
  alphabet,
  classify,
  complement,
  complete,
  concat,
  determinize,
  equivalent,
  intersection,
  minimize,
  removeUnreachable,
  removeUseless,
  star,
  union,
} from './index';
import { FA_EXAMPLES } from './examples';
import { acceptor, allWords, example, fa, lengthFor } from './test-helpers';

/** Palavras para conferir uma operação: Σ_a ∪ Σ_b, até ~2000 palavras. */
function wordsFor(...fas: FA[]): string[] {
  const sigma = [...new Set(fas.flatMap(alphabet))].sort();
  return allWords(sigma, lengthFor(sigma, 6, 2000));
}

function splits(w: string): Array<[string, string]> {
  return Array.from({ length: w.length + 1 }, (_, i) => [w.slice(0, i), w.slice(i)] as [string, string]);
}

function inStar(inL: (w: string) => boolean, w: string): boolean {
  const ok = [true];
  for (let j = 1; j <= w.length; j++) {
    ok[j] = false;
    for (let i = 0; i < j && !ok[j]; i++) if (ok[i] && inL(w.slice(i, j))) ok[j] = true;
  }
  return ok[w.length]!;
}

/** Saída do núcleo: no máximo uma transição por par, símbolos em ordem e ids únicos. */
function expectWellFormed(a: FA) {
  const pairs = a.transitions.map((t) => `${t.from}>${t.to}`);
  expect(new Set(pairs).size).toBe(pairs.length);
  expect(new Set(a.states.map((s) => s.id)).size).toBe(a.states.length);
  expect(new Set(a.transitions.map((t) => t.id)).size).toBe(a.transitions.length);
  for (const t of a.transitions) {
    expect(t.symbols.length).toBeGreaterThan(0);
    expect(new Set(t.symbols).size).toBe(t.symbols.length);
  }
}

const PAIRS: Array<[string, string]> = [
  ['afd-termina-01', 'afn-termina-10'],
  ['afd-contem-01', 'afd-0-par-ou-1-impar'],
  ['enfa-numero-decimal', 'afd-so-01'],
  ['afd-minimizacao-parcial', 'minimizacao-07'],
  ['minimizacao-06', 'afn-estados-inuteis'],
  ['afn-termina-11', 'afn-termina-11'],
];

describe('complete', () => {
  it('cria ∅ com laço e manda para ele o que falta; mantém ids e nomes', () => {
    const a = example('afd-so-01').fa;
    const c = complete(a);
    expect(c.states.slice(0, 3)).toEqual(a.states);
    expect(c.states[3]).toEqual({ id: 'q3', name: '∅', initial: false, final: false });
    expect(c.transitions.slice(0, 2)).toEqual(a.transitions);
    expect(c.transitions.slice(2)).toEqual([
      { id: 't2', from: 'q0', to: 'q3', symbols: ['1'] },
      { id: 't3', from: 'q1', to: 'q3', symbols: ['0'] },
      { id: 't4', from: 'q2', to: 'q3', symbols: ['0', '1'] },
      { id: 't5', from: 'q3', to: 'q3', symbols: ['0', '1'] },
    ]);
    expect(equivalent(a, c).equivalent).toBe(true);
  });

  it('já completo: não cria estado', () => {
    const a = example('afd-termina-01').fa;
    expect(complete(a)).toEqual(a);
  });

  it('sigma maior que o alfabeto: completa também os símbolos novos', () => {
    const c = complete(example('afd-termina-01').fa, ['0', '1', '2']);
    expect(c.states).toHaveLength(4);
    expect(c.transitions.filter((t) => t.to === 'q3').flatMap((t) => t.symbols)).toEqual(['2', '2', '2', '0', '1', '2']);
  });

  it('nome ∅ já usado: ∅1', () => {
    const a = fa('q0', ['q1'], ['q0 a q1']);
    a.states[1]!.name = '∅';
    expect(complete(a).states.map((s) => s.name)).toEqual(['q0', '∅', '∅1']);
  });

  it('AFN: só cria saída para (estado, símbolo) sem nenhum destino', () => {
    const c = complete(example('afn-termina-01').fa);
    expect(c.transitions.filter((t) => t.to === 'q3').map((t) => [t.from, t.symbols])).toEqual([
      ['q1', ['0']],
      ['q2', ['0', '1']],
      ['q3', ['0', '1']],
    ]);
  });

  it('junta pares (from, to) repetidos e ignora símbolos inválidos', () => {
    const a = fa('q0', ['q0'], ['q0 a q0', 'q0 b q0']);
    a.transitions[1]!.symbols = ['b', 'xy'];
    expect(complete(a).transitions).toEqual([{ id: 't0', from: 'q0', to: 'q0', symbols: ['a', 'b'] }]);
  });
});

describe('complement', () => {
  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s: palavra por palavra', (_id, a) => {
    const c = complement(a);
    expect(classify(c)).toBe('DFA');
    expectWellFormed(c);
    const inA = acceptor(a);
    const inC = acceptor(c);
    for (const w of wordsFor(a)) expect(inC(w), w).toBe(!inA(w));
  });

  it('AFD: mantém os estados e troca os finais', () => {
    const c = complement(example('afd-termina-01').fa);
    expect(c.states.map((s) => [s.name, s.final])).toEqual([['q0', true], ['q1', true], ['q2', false]]);
  });

  it('em relação a um sigma maior', () => {
    const c = complement(example('afd-termina-01').fa, ['0', '1', '2']);
    expect(accepts(c, '2')).toBe(true);
    expect(accepts(c, '012')).toBe(true);
    expect(accepts(c, '01')).toBe(false);
  });

  it('em relação a um sigma menor: palavras com outros símbolos ficam de fora', () => {
    const c = complement(example('afd-minimizacao-parcial').fa, ['a']);
    expect(accepts(c, 'aaa')).toBe(true);
    expect(accepts(c, 'ab')).toBe(false);
  });

  it('autômato vazio: o complemento aceita tudo', () => {
    const c = complement(fa(null, [], ['q0 a q0']));
    expect(accepts(c, '')).toBe(true);
    expect(accepts(c, 'aaa')).toBe(true);
  });
});

describe.each(PAIRS)('operações com %s e %s', (idA, idB) => {
  const a = example(idA).fa;
  const b = example(idB).fa;
  const inA = acceptor(a);
  const inB = acceptor(b);
  const words = wordsFor(a, b);

  it('union = L(a) ∪ L(b)', () => {
    const u = union(a, b);
    expectWellFormed(u);
    expect(u.states).toHaveLength(a.states.length + b.states.length + 1);
    const inU = acceptor(u);
    for (const w of words) expect(inU(w), w).toBe(inA(w) || inB(w));
  });

  it('concat = L(a)·L(b)', () => {
    const c = concat(a, b);
    expectWellFormed(c);
    const inC = acceptor(c);
    for (const w of words) expect(inC(w), w).toBe(splits(w).some(([x, y]) => inA(x) && inB(y)));
  });

  it('star = L(a)*', () => {
    const s = star(a);
    expectWellFormed(s);
    expect(accepts(s, '')).toBe(true);
    const inS = acceptor(s);
    for (const w of words) expect(inS(w), w).toBe(inStar(inA, w));
  });

  it('intersection = L(a) ∩ L(b)', () => {
    const i = intersection(a, b);
    expectWellFormed(i);
    expect(classify(i)).not.toBe('NFA');
    const inI = acceptor(i);
    for (const w of words) expect(inI(w), w).toBe(inA(w) && inB(w));
  });
});

describe('construções (formato do resultado)', () => {
  const a = example('afd-termina-01').fa;
  const b = example('afn-termina-10').fa;

  it('union: novo inicial q0 com ε para os dois iniciais; nomes q0, q1, ... em largura', () => {
    const u = union(a, b);
    expect(u.states.map((s) => s.id)).toEqual(u.states.map((s) => s.name));
    expect(u.states.map((s) => s.id)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
    expect(u.states.filter((s) => s.initial).map((s) => s.id)).toEqual(['q0']);
    expect(u.transitions.filter((t) => t.from === 'q0')).toEqual([
      { id: 't0', from: 'q0', to: 'q1', symbols: ['ε'] },
      { id: 't1', from: 'q0', to: 'q2', symbols: ['ε'] },
    ]);
    expect(classify(u)).toBe('ENFA');
  });

  it('concat: o inicial de a continua inicial; os finais de a deixam de ser finais', () => {
    const c = concat(a, b);
    expect(c.states.filter((s) => s.initial)).toHaveLength(1);
    expect(c.states.filter((s) => s.final)).toHaveLength(1);
    expect(c.transitions.filter((t) => t.symbols.includes('ε'))).toHaveLength(1);
  });

  it('star: novo inicial final', () => {
    const s = star(a);
    expect(s.states[0]).toEqual({ id: 'q0', name: 'q0', initial: true, final: true });
    expect(s.states).toHaveLength(4);
  });

  it('intersection: só pares alcançáveis', () => {
    const i = intersection(example('afd-contem-01').fa, example('afd-termina-10').fa);
    expect(i.states.length).toBeLessThanOrEqual(9);
    expect(accepts(i, '010')).toBe(true);
    expect(accepts(i, '01')).toBe(false);
  });

  it('alfabetos sem nada em comum: interseção só pode ter ε', () => {
    const i = intersection(example('afd-contem-01').fa, example('minimizacao-06').fa);
    expect(i.transitions).toEqual([]);
    expect(accepts(i, '')).toBe(false);
  });

  it('sem inicial: as construções continuam válidas', () => {
    const none = fa(null, ['q1'], ['q0 a q1']);
    expect(accepts(union(none, a), '01')).toBe(true);
    expect(accepts(concat(none, a), '01')).toBe(false);
    expect(accepts(concat(a, none), '01')).toBe(false);
    expect(accepts(star(none), '')).toBe(true);
    expect(accepts(star(none), 'a')).toBe(false);
    expect(intersection(none, a).states).toHaveLength(1);
  });
});

describe('removeUnreachable', () => {
  it('tira E, F, G e H (minimizacao-02) e mantém ids e nomes', () => {
    const a = example('minimizacao-02').fa;
    const r = removeUnreachable(a);
    expect(r.states).toEqual(a.states.slice(0, 4));
    expect(r.transitions.every((t) => ['q0', 'q1', 'q2', 'q3'].includes(t.from))).toBe(true);
    expect(equivalent(a, r).equivalent).toBe(true);
  });

  it('segue transições ε', () => {
    const r = removeUnreachable(fa('q0', ['q2'], ['q0 ε q1', 'q1 a q2', 'q3 a q2']));
    expect(r.states.map((s) => s.id)).toEqual(['q0', 'q1', 'q2']);
  });

  it('sem inicial: não sobra nada', () => {
    expect(removeUnreachable(fa(null, [], ['q0 a q1']))).toEqual({ states: [], transitions: [] });
  });
});

describe('removeUseless', () => {
  it('AFN com estados inúteis: sobram q0 a q5', () => {
    const a = example('afn-estados-inuteis').fa;
    const r = removeUseless(a);
    expect(r.states.map((s) => s.name)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
    expect(equivalent(a, r).equivalent).toBe(true);
    expectWellFormed(r);
  });

  it('remove o estado morto', () => {
    const r = removeUseless(example('minimizacao-09').fa);
    expect(r.states.map((s) => s.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('linguagem vazia: não sobra nada (igual ao YAAS)', () => {
    expect(removeUseless(fa('q0', [], ['q0 a q1']))).toEqual({ states: [], transitions: [] });
  });
});

describe('equivalent', () => {
  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s ≡ determinize ≡ minimize', (_id, a) => {
    expect(equivalent(a, determinize(a).dfa)).toEqual({ equivalent: true });
    expect(equivalent(a, minimize(a).dfa)).toEqual({ equivalent: true });
    expect(equivalent(a, a)).toEqual({ equivalent: true });
  });

  it('AFD e AFN da mesma linguagem', () => {
    expect(equivalent(example('afd-termina-00').fa, example('afn-termina-00').fa)).toEqual({ equivalent: true });
    expect(equivalent(example('afd-contem-01').fa, example('afd-minimizacao-dois-grupos').fa)).toEqual({
      equivalent: true,
    });
  });

  it('menor contraexemplo; empate em ordem alfabética', () => {
    // termina em 01 × termina em 10: 01 e 10 têm tamanho 2; 01 vem antes
    expect(equivalent(example('afd-termina-01').fa, example('afd-termina-10').fa)).toEqual({
      equivalent: false,
      counterexample: '01',
    });
    expect(equivalent(example('afd-termina-10').fa, example('afd-termina-01').fa).counterexample).toBe('01');
    // contém 01 × termina em 01: 010 é a menor que separa
    expect(equivalent(example('afd-contem-01').fa, example('afd-termina-01').fa).counterexample).toBe('010');
  });

  it('a palavra vazia pode ser o contraexemplo', () => {
    const a = example('afd-termina-01').fa;
    expect(equivalent(a, star(a))).toEqual({ equivalent: false, counterexample: '' });
  });

  it('alfabetos diferentes', () => {
    const r = equivalent(example('afd-minimizacao-parcial').fa, example('minimizacao-07').fa);
    expect(r).toEqual({ equivalent: false, counterexample: 'aa' });
  });

  it('dois autômatos vazios (ou sem inicial) são equivalentes', () => {
    expect(equivalent({ states: [], transitions: [] }, fa(null, ['q0'], ['q0 a q0']))).toEqual({
      equivalent: true,
    });
  });
});
