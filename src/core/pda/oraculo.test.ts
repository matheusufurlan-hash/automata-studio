/**
 * Comparação com o YAAS ORIGINAL (o oráculo) — AP.
 *
 * __fixtures__/oraculo.json é gerado por tools/oraculo/GerarOraculoAP.java,
 * que roda o YAAS-1.0.7.jar em cada exemplo. Para regerar, veja o comentário
 * no topo desse arquivo Java.
 *
 * O AP do YAAS não segue o Hopcroft (operações DO_NOTHING/POP/PUSH/REPLACE e
 * "topo ε"), mas a tradução para "a, X/γ" preserva o comportamento: nos 14
 * exemplos, as palavras aceitas (tamanho 0 a 6) são as mesmas.
 *
 * Diferenças CONHECIDAS e de propósito:
 *  - ap-transicao-vazia-com-pilha-vazia: o exemplo do YAAS usa "topo ε" (só
 *    casa com a pilha vazia), que não existe no Hopcroft; o nosso foi
 *    adaptado com o Z no fundo e aceita a mesma linguagem {ε}. A CONVERSÃO do
 *    YAAS para pilha vazia, porém, quebra o exemplo dele: depois de tirar o
 *    Z, o novo fundo X0 fica na pilha e o "topo ε" nunca mais casa, então o
 *    AP convertido do YAAS não aceita nada. A nossa conversão segue o
 *    Teorema 6.11 e preserva {ε}.
 *  - o novo fundo de pilha X0 das conversões: o YAAS usa 'X' ou, se 'X' já
 *    está em Γ, a 1ª letra maiúscula livre ('A'); nós seguimos a convenção do
 *    index.ts ('X', '$', '#', '⊥', '@'). Não muda nada na linguagem.
 */
import oracleJson from './__fixtures__/oraculo.json';
import type { PDA, PDAAcceptance, Sym } from './types';
import { classify, inputAlphabet, stackAlphabet, toEmptyStack, toFinalState } from './index';
import { PDA_EXAMPLES } from './examples';
import { buildGraph } from './internal';
import { simulateInGraph } from './simulate';
import { allWords } from './test-helpers';
import { summarize, type LanguageSummary } from '../fa/test-helpers';

interface OracleExample {
  id: string;
  source: string;
  acceptance: PDAAcceptance;
  type: string;
  alphabet: Sym[];
  stackAlphabet: Sym[];
  startStackSymbol: Sym;
  maxLength: number;
  accepted: LanguageSummary;
  conversion: {
    algorithm: string;
    acceptance: PDAAcceptance;
    states: number;
    transitions: number;
    rules: number;
    startStackSymbol: Sym;
    accepted: LanguageSummary;
  };
}

const oracle = oracleJson as unknown as { examples: OracleExample[] };

/** Exemplos em que a CONVERSÃO do YAAS dá outra linguagem (errada): ver o topo do arquivo. */
const YAAS_CONVERSION_BUGS = ['ap-transicao-vazia-com-pilha-vazia'];

function example(id: string) {
  const e = PDA_EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`exemplo desconhecido: ${id}`);
  return e;
}

/** Palavras aceitas de tamanho 0 a maxLength (ordem de allWords). */
function acceptedWords(pda: PDA, sigma: Sym[], maxLength: number): string[] {
  const g = buildGraph(pda);
  return allWords(sigma, maxLength).filter((w) => simulateInGraph(g, pda, w).accepted);
}

async function expectLanguage(pda: PDA, expected: LanguageSummary, sigma: Sym[], maxLength: number) {
  const words = acceptedWords(pda, sigma, maxLength);
  const ours = await summarize(words, maxLength, expected.words !== undefined);
  if (expected.words) expect(ours.words).toEqual(expected.words);
  expect(ours.counts).toEqual(expected.counts);
  expect(ours.sha256).toEqual(expected.sha256);
}

const ruleCount = (p: PDA) => p.transitions.reduce((n, t) => n + t.rules.length, 0);

describe('oráculo AP: arquivo e exemplos', () => {
  it('tem os mesmos 14 exemplos de PDA_EXAMPLES, na mesma ordem', () => {
    expect(oracle.examples.map((e) => e.id)).toEqual(PDA_EXAMPLES.map((e) => e.id));
    expect(oracle.examples).toHaveLength(14);
  });
});

describe.each(oracle.examples)('oráculo AP: $id ($source)', (o) => {
  const { pda } = example(o.id);

  it('mesmo modo de aceitação, mesmo tipo e mesmos alfabetos', () => {
    expect(pda.acceptance).toBe(o.acceptance);
    expect(classify(pda)).toBe(o.type);
    expect(inputAlphabet(pda)).toEqual(o.alphabet);
    expect(stackAlphabet(pda)).toEqual(o.stackAlphabet);
    expect(pda.startStackSymbol).toBe(o.startStackSymbol);
  });

  it(`mesmas palavras aceitas (tamanho 0 a ${o.maxLength})`, async () => {
    await expectLanguage(pda, o.accepted, o.alphabet, o.maxLength);
  });

  it(`conversão para o outro modo (${o.conversion.algorithm}): mesmo tamanho e mesma linguagem`, async () => {
    const converted = o.acceptance === 'FINAL_STATE' ? toEmptyStack(pda) : toFinalState(pda);
    expect(converted.acceptance).toBe(o.conversion.acceptance);
    expect(converted.states).toHaveLength(o.conversion.states);
    expect(converted.transitions).toHaveLength(o.conversion.transitions);
    expect(ruleCount(converted)).toBe(o.conversion.rules);

    if (YAAS_CONVERSION_BUGS.includes(o.id)) {
      // o YAAS dá outra resposta (errada): conferimos que a diferença continua
      // lá e que a nossa conversão preserva a linguagem do original
      const summary = await summarize(acceptedWords(converted, o.alphabet, o.maxLength), o.maxLength, false);
      expect(summary.counts).not.toEqual(o.conversion.accepted.counts);
      await expectLanguage(converted, o.accepted, o.alphabet, o.maxLength);
    } else {
      await expectLanguage(converted, o.conversion.accepted, o.alphabet, o.maxLength);
    }
  });
});

it('a conversão do YAAS no exemplo com "topo ε" não aceita nada; a nossa aceita ε', () => {
  const o = oracle.examples.find((e) => e.id === 'ap-transicao-vazia-com-pilha-vazia')!;
  expect(o.accepted.words).toEqual(['']);
  expect(o.conversion.accepted.counts).toEqual([0]);
  const ours = toEmptyStack(example(o.id).pda);
  expect(acceptedWords(ours, [], 0)).toEqual(['']);
});
