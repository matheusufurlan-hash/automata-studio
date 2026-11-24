/**
 * Comparação com o YAAS ORIGINAL (o oráculo).
 *
 * __fixtures__/oraculo.json é gerado por tools/oraculo/GerarOraculo.java, que
 * roda os algoritmos do YAAS-1.0.7.jar em cada exemplo. Para regerar, veja o
 * comentário no topo desse arquivo Java.
 *
 * Diferenças CONHECIDAS e de propósito (não são bugs nossos):
 *  - determinize: o YAAS nunca cria o estado ∅; nós criamos quando ele é
 *    alcançado. Comparamos com `statesWithEmptySet` (o nº do YAAS + 1 quando o
 *    AFD do YAAS é parcial) e, tirando o ∅, com `states`.
 *  - minimize: o DFAMinimize do YAAS remove estados inúteis e devolve um AFD
 *    parcial; o nosso mínimo é completo (como no Hopcroft). Comparamos com
 *    `statesWithDeadState` (o nº do YAAS + 1 quando o mínimo do YAAS é parcial).
 *
 * BUGS do YAAS 1.0.7 que NÃO copiamos (ver YAAS_BUGS abaixo):
 *  - FAUnion deixa o 1º estado do 2º autômato marcado como inicial; depois
 *    FA.accepts lança NullPointerException. O oráculo contorna o bug para
 *    conseguir a linguagem (campo `yaasBug`), e a linguagem bate com a nossa.
 *  - FAIntersection usa De Morgan (complemento → união → complemento) com o
 *    alfabeto de CADA autômato. Quando os alfabetos são diferentes, aceita
 *    palavras que não estão na interseção. Ex.: L(A) = {aab, baa} sobre {a,b}
 *    e L(B) sobre {a,b,c}: o YAAS aceita "acb" (que nem está em L(A)). A nossa
 *    interseção é o produto dos AFDs e segue a definição.
 */
import oracleJson from './__fixtures__/oraculo.json';
import { EPSILON } from './types';
import type { FA, Sym } from './types';
import {
  accepts,
  alphabet,
  classify,
  complement,
  concat,
  determinize,
  intersection,
  minimize,
  removeUseless,
  simulate,
  star,
  union,
} from './index';
import { FA_EXAMPLES } from './examples';
import {
  acceptedWords,
  acceptor,
  allWords,
  example,
  lengthFor,
  summarize,
  type LanguageSummary,
} from './test-helpers';

interface OracleLanguage extends LanguageSummary {
  yaasBug?: string;
}

interface OracleExample {
  id: string;
  source: string;
  type: string;
  alphabet: Sym[];
  maxLength: number;
  accepted: OracleLanguage;
  determinize: { states: number; statesWithEmptySet: number };
  minimize: { states: number; statesWithDeadState: number };
  complement: OracleLanguage;
  removeUseless: string[];
}

interface OracleOperation {
  a: string;
  b: string;
  alphabet: Sym[];
  maxLength: number;
  union: OracleLanguage;
  concat: OracleLanguage;
  starA: OracleLanguage;
  starB: OracleLanguage;
  intersection: OracleLanguage;
}

const oracle = oracleJson as unknown as { examples: OracleExample[]; operations: OracleOperation[] };

/** Casos em que o YAAS original está errado: [a, b, operação]. */
const YAAS_BUGS: Array<[string, string, keyof OracleOperation]> = [
  // interseção com alfabetos diferentes ({a,b} e {a,b,c}): ver comentário no topo
  ['afd-minimizacao-parcial', 'minimizacao-07', 'intersection'],
  // 13 símbolos × {0,1}: o YAAS devolve o próprio L(número decimal)
  ['enfa-numero-decimal', 'afd-so-01', 'intersection'],
];

async function expectLanguage(fa: FA, expected: LanguageSummary, sigma: Sym[], maxLength: number) {
  const words = acceptedWords(fa, sigma, maxLength);
  const ours = await summarize(words, maxLength, expected.words !== undefined);
  if (expected.words) expect(ours.words).toEqual(expected.words);
  expect(ours.counts).toEqual(expected.counts);
  expect(ours.sha256).toEqual(expected.sha256);
}

describe('oráculo: arquivo e exemplos', () => {
  it('tem os mesmos exemplos de FA_EXAMPLES, na mesma ordem', () => {
    expect(oracle.examples.map((e) => e.id)).toEqual(FA_EXAMPLES.map((e) => e.id));
    expect(oracle.examples).toHaveLength(24);
  });
});

describe.each(oracle.examples)('oráculo: $id ($source)', (o) => {
  const { fa } = example(o.id);

  it('mesmo tipo e mesmo alfabeto', () => {
    expect(classify(fa)).toBe(o.type);
    expect(alphabet(fa)).toEqual(o.alphabet);
  });

  it(`mesmas palavras aceitas (tamanho 0 a ${o.maxLength})`, async () => {
    await expectLanguage(fa, o.accepted, o.alphabet, o.maxLength);
  });

  it('simulate e accepts concordam com o oráculo palavra por palavra', () => {
    const accepted = new Set(acceptedWords(fa, o.alphabet, o.maxLength));
    // simulate monta todos os passos: até ~3000 palavras já cobre o caso
    for (const w of allWords(o.alphabet, lengthFor(o.alphabet, o.maxLength, 3000))) {
      expect(simulate(fa, w).accepted, w).toBe(accepted.has(w));
      expect(accepts(fa, w), w).toBe(accepted.has(w));
    }
  });

  it('determinize: mesmo nº de estados (contando o ∅) e mesma linguagem', async () => {
    const { dfa, subsets } = determinize(fa);
    expect(classify(dfa)).toBe('DFA');
    expect(dfa.states).toHaveLength(o.determinize.statesWithEmptySet);
    const nonEmpty = dfa.states.filter((s) => subsets[s.id]!.length > 0);
    expect(nonEmpty).toHaveLength(o.determinize.states);
    await expectLanguage(dfa, o.accepted, o.alphabet, o.maxLength);
  });

  it('minimize: mesmo nº de estados do mínimo (contando o estado morto) e mesma linguagem', async () => {
    const { dfa } = minimize(fa);
    expect(dfa.states).toHaveLength(o.minimize.statesWithDeadState);
    await expectLanguage(dfa, o.accepted, o.alphabet, o.maxLength);
  });

  it('complement: mesmas palavras aceitas', async () => {
    await expectLanguage(complement(fa), o.complement, o.alphabet, o.maxLength);
  });

  it('removeUseless: sobram os mesmos estados', () => {
    const names = removeUseless(fa).states.map((s) => s.name);
    expect([...names].sort()).toEqual([...o.removeUseless].sort());
  });
});

describe.each(oracle.operations)('oráculo: operações com $a e $b', (o) => {
  const a = example(o.a).fa;
  const b = example(o.b).fa;
  const inA = acceptor(a);
  const inB = acceptor(b);
  const isBug = (op: keyof OracleOperation) => YAAS_BUGS.some(([x, y, z]) => x === o.a && y === o.b && z === op);

  const cases: Array<[keyof OracleOperation, () => FA, (w: string) => boolean]> = [
    ['union', () => union(a, b), (w) => inA(w) || inB(w)],
    ['concat', () => concat(a, b), (w) => splits(w).some(([x, y]) => inA(x) && inB(y))],
    ['starA', () => star(a), (w) => inStar(inA, w)],
    ['starB', () => star(b), (w) => inStar(inB, w)],
    ['intersection', () => intersection(a, b), (w) => inA(w) && inB(w)],
  ];

  it.each(cases)('%s', async (op, build, definition) => {
    const result = build();
    const expected = o[op] as OracleLanguage;
    // a nossa operação sempre segue a definição, palavra por palavra
    const words = allWords(o.alphabet, o.maxLength);
    const ours = words.filter(acceptor(result));
    expect(ours).toEqual(words.filter(definition));

    if (isBug(op)) {
      // o YAAS dá outra resposta (errada): conferimos que a diferença continua lá
      const summary = await summarize(ours, o.maxLength, false);
      expect(summary.sha256).not.toEqual(expected.sha256);
    } else {
      await expectLanguage(result, expected, o.alphabet, o.maxLength);
    }
  });
});

function splits(w: string): Array<[string, string]> {
  const chars = Array.from(w);
  return chars.map((_, i) => [chars.slice(0, i).join(''), chars.slice(i).join('')] as [string, string]).concat([[w, '']]);
}

/** w ∈ L* pela definição (programação dinâmica nos prefixos). */
function inStar(inL: (w: string) => boolean, w: string): boolean {
  const chars = Array.from(w);
  const ok = [true];
  for (let j = 1; j <= chars.length; j++) {
    ok[j] = false;
    for (let i = 0; i < j && !ok[j]; i++) {
      if (ok[i] && inL(chars.slice(i, j).join(''))) ok[j] = true;
    }
  }
  return ok[chars.length]!;
}

// garante que o símbolo ε do contrato é o mesmo do YAAS (U+03B5)
it('ε é U+03B5, como no YAAS', () => {
  expect(EPSILON).toBe('ε');
});
