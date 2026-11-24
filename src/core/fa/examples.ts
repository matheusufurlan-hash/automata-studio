/**
 * Exemplos do YAAS original (Prof. Dr. David Buzatto, GPL v3), convertidos de
 * br/com/davidbuzatto/yaas/model/fa/examples/ (FAExamples: 14,
 * FAExamplesForMinimizationTest: 9, FAExamplesForRemoveUselessAndInaccessibleStates: 1).
 *
 * Gerado a partir da estrutura gravada pelo oráculo
 * (tools/oraculo/GerarOraculo.java -> __fixtures__/oraculo.json); o teste
 * examples.test.ts confere que cada exemplo continua igual ao do YAAS.
 *
 * Desenho:
 *  - `layout.positions`: o CENTRO de cada estado, em pixels (como no YAAS);
 *  - `curvature`: deslocamento do meio da curva em relação ao meio da reta
 *    entre os centros, dividido pelo comprimento da reta (0 = reta; positivo =
 *    curva para a esquerda de quem anda de `from` para `to`, vendo a tela);
 *  - `loopAngle`: graus, 0 = laço em cima, sentido horário.
 */
import type { EdgeLayout, FA, Layout, StateId } from './types';
import { sortSymbols } from './internal';

export interface FAExample {
  id: string;
  name: string;
  description: string;
  fa: FA;
  layout: Layout;
}

/** [nome, x, y, marcas]: marcas 'i' = inicial, 'f' = final. */
type StateSpec = [name: string, x: number, y: number, marks?: string];
/** [de, para, símbolos (cada caractere é um símbolo), curvatura ou ângulo do laço]. */
type TransitionSpec = [from: string, to: string, symbols: string, shape?: number];

function example(
  id: string,
  name: string,
  description: string,
  states: StateSpec[],
  transitions: TransitionSpec[],
): FAExample {
  const idOf = new Map<string, StateId>(states.map(([n], i) => [n, `q${i}`]));
  const fa: FA = {
    states: states.map(([n, , , marks = ''], i) => ({
      id: `q${i}`,
      name: n,
      initial: marks.includes('i'),
      final: marks.includes('f'),
    })),
    transitions: transitions.map(([from, to, symbols], i) => ({
      id: `t${i}`,
      from: idOf.get(from)!,
      to: idOf.get(to)!,
      symbols: sortSymbols(Array.from(symbols)),
    })),
  };
  const positions: Layout['positions'] = {};
  states.forEach(([, x, y], i) => {
    positions[`q${i}`] = { x, y };
  });
  const edges: Record<string, EdgeLayout> = {};
  transitions.forEach(([from, to, , shape = 0], i) => {
    edges[`t${i}`] = from === to ? { curvature: 0, loopAngle: shape } : { curvature: shape };
  });
  return { id, name, description, fa, layout: { positions, edges } };
}

export const FA_EXAMPLES: FAExample[] = [
  // FAExamples.createDFASubstring01
  example(
    'afd-contem-01',
    'AFD: contém 01',
    'Palavras sobre {0,1} que contêm a subpalavra 01.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '1'], ['q0', 'q1', '0'], ['q1', 'q1', '0'], ['q1', 'q2', '1'],
      ['q2', 'q2', '01'],
    ],
  ),
  // FAExamples.createDFAEndsWith00
  example(
    'afd-termina-00',
    'AFD: termina em 00',
    'Palavras sobre {0,1} que terminam em 00.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '1'], ['q0', 'q1', '0', 0.15], ['q1', 'q2', '0'], ['q1', 'q0', '1', 0.15],
      ['q2', 'q2', '0'], ['q2', 'q0', '1', 0.2],
    ],
  ),
  // FAExamples.createDFAEndsWith01
  example(
    'afd-termina-01',
    'AFD: termina em 01',
    'Palavras sobre {0,1} que terminam em 01.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '1'], ['q0', 'q1', '0'], ['q1', 'q1', '0'], ['q1', 'q2', '1', 0.15],
      ['q2', 'q1', '0', 0.15], ['q2', 'q0', '1', 0.2],
    ],
  ),
  // FAExamples.createDFAEndsWith10
  example(
    'afd-termina-10',
    'AFD: termina em 10',
    'Palavras sobre {0,1} que terminam em 10.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '0'], ['q0', 'q1', '1'], ['q1', 'q1', '1'], ['q1', 'q2', '0', 0.15],
      ['q2', 'q1', '1', 0.15], ['q2', 'q0', '0', 0.2],
    ],
  ),
  // FAExamples.createDFAEndsWith11
  example(
    'afd-termina-11',
    'AFD: termina em 11',
    'Palavras sobre {0,1} que terminam em 11.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '0'], ['q0', 'q1', '1', 0.15], ['q1', 'q2', '1'], ['q1', 'q0', '0', 0.15],
      ['q2', 'q2', '1'], ['q2', 'q0', '0', 0.2],
    ],
  ),
  // FAExamples.createDFA0Even1Odd
  example(
    'afd-0-par-ou-1-impar',
    'AFD: 0 par ou 1 ímpar',
    'L = { 0ⁱ ∪ 1ʲ | i > 0 e par, j > 0 e ímpar }: só zeros em quantidade par, ou só uns em quantidade ímpar.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 100], ['q2', 400, 100, 'f'], ['q3', 250, 300, 'f'],
      ['q4', 400, 300],
    ],
    [
      ['q0', 'q1', '0', 0.11], ['q0', 'q3', '1', -0.1], ['q1', 'q2', '0', 0.15],
      ['q2', 'q1', '0', 0.15], ['q3', 'q4', '1', 0.15], ['q4', 'q3', '1', 0.15],
    ],
  ),
  // FAExamples.createNFAEndsWith00
  example(
    'afn-termina-00',
    'AFN: termina em 00',
    'AFN que "adivinha" onde começa o 00 final. Bom para determinizar.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '01'], ['q0', 'q1', '0'], ['q1', 'q2', '0'],
    ],
  ),
  // FAExamples.createNFAEndsWith01
  example(
    'afn-termina-01',
    'AFN: termina em 01',
    'AFN que "adivinha" onde começa o 01 final. Bom para determinizar.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '01'], ['q0', 'q1', '0'], ['q1', 'q2', '1'],
    ],
  ),
  // FAExamples.createNFAEndsWith10
  example(
    'afn-termina-10',
    'AFN: termina em 10',
    'AFN que "adivinha" onde começa o 10 final. Bom para determinizar.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '01'], ['q0', 'q1', '1'], ['q1', 'q2', '0'],
    ],
  ),
  // FAExamples.createNFAEndsWith11
  example(
    'afn-termina-11',
    'AFN: termina em 11',
    'AFN que "adivinha" onde começa o 11 final. Bom para determinizar.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q0', '01'], ['q0', 'q1', '1'], ['q1', 'q2', '1'],
    ],
  ),
  // FAExamples.createENFADecimalNumber
  example(
    'enfa-numero-decimal',
    'ε-AFN: número decimal',
    'Números decimais com sinal opcional (+ ou -) e ponto obrigatório: 3.14, -.5 e 7. são aceitos; 42 não. É o ε-AFN clássico do livro do Hopcroft.',
    [
      ['q0', 75, 150, 'i'], ['q1', 250, 150], ['q2', 350, 150], ['q3', 575, 150], ['q4', 350, 300],
      ['q5', 700, 150, 'f'],
    ],
    [
      ['q0', 'q1', 'ε+-'], ['q1', 'q1', '0123456789'], ['q1', 'q2', '.'],
      ['q1', 'q4', '0123456789'], ['q2', 'q3', '0123456789'], ['q3', 'q3', '0123456789'],
      ['q3', 'q5', 'ε'], ['q4', 'q3', '.'],
    ],
  ),
  // FAExamples.createDFAForRejectionStep
  example(
    'afd-so-01',
    'AFD parcial: só 01',
    'Aceita só a palavra 01. Faltam transições: simule 00 ou 010 para ver a simulação morrer no meio.',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f'],
    ],
    [
      ['q0', 'q1', '0'], ['q1', 'q2', '1'],
    ],
  ),
  // FAExamples.createDFAForMinimizationTwoGroups
  example(
    'afd-minimizacao-dois-grupos',
    'Minimização: dois grupos',
    'Contém 01, com estados repetidos: T0/T1 e U0/U1 são equivalentes. O mínimo tem 3 estados.',
    [
      ['q0', 100, 225, 'i'], ['q1', 275, 125], ['q2', 275, 325], ['q3', 475, 125, 'f'],
      ['q4', 475, 325, 'f'],
    ],
    [
      ['q0', 'q0', '1'], ['q0', 'q1', '0'], ['q1', 'q2', '0'], ['q1', 'q3', '1'], ['q2', 'q1', '0'],
      ['q2', 'q4', '1'], ['q3', 'q4', '0'], ['q3', 'q3', '1'], ['q4', 'q3', '0'], ['q4', 'q4', '1'],
    ],
  ),
  // FAExamples.createDFAForMinimizationPartial
  example(
    'afd-minimizacao-parcial',
    'Minimização: AFD parcial',
    'Aceita só aab e baa. q1 e q2 parecem iguais, mas a palavra ab separa os dois.',
    [
      ['q0', 100, 225, 'i'], ['q1', 250, 125], ['q2', 250, 325], ['q3', 400, 125], ['q4', 400, 325],
      ['q5', 550, 225, 'f'],
    ],
    [
      ['q0', 'q1', 'a'], ['q0', 'q2', 'b'], ['q1', 'q3', 'a'], ['q2', 'q4', 'a'], ['q3', 'q5', 'b'],
      ['q4', 'q5', 'a'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest01
  example(
    'minimizacao-01',
    'Minimização 1: A a H',
    'O AFD de 8 estados (A a H) do exemplo clássico de minimização do Hopcroft. D é inalcançável.',
    [
      ['A', 100, 100, 'i'], ['B', 250, 100], ['C', 400, 100, 'f'], ['D', 550, 100], ['E', 100, 250],
      ['F', 250, 250], ['G', 400, 250], ['H', 550, 250],
    ],
    [
      ['A', 'B', '0'], ['A', 'F', '1'], ['B', 'C', '1'], ['B', 'G', '0'], ['C', 'C', '1'],
      ['C', 'A', '0', -0.18], ['D', 'C', '0'], ['D', 'G', '1'], ['E', 'F', '1'],
      ['E', 'H', '0', -0.2], ['F', 'C', '0'], ['F', 'G', '1'], ['G', 'G', '0', 180],
      ['G', 'E', '1', 0.17], ['H', 'C', '1'], ['H', 'G', '0'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest02
  example(
    'minimizacao-02',
    'Minimização 2',
    'AFD de 8 estados em que E, F, G e H são inalcançáveis.',
    [
      ['A', 100, 100, 'i'], ['B', 250, 100], ['C', 400, 100], ['D', 550, 100, 'f'], ['E', 100, 250],
      ['F', 250, 250], ['G', 400, 250], ['H', 550, 250],
    ],
    [
      ['A', 'B', '0', 0.18], ['A', 'A', '1'], ['B', 'A', '0', 0.16], ['B', 'C', '1', 0.16],
      ['C', 'D', '0'], ['C', 'B', '1', 0.16], ['D', 'D', '0'], ['D', 'A', '1', -0.13],
      ['E', 'D', '0', 0.07], ['E', 'F', '1', 0.17], ['F', 'G', '0', 0.16], ['F', 'E', '1', 0.16],
      ['G', 'F', '0', 0.15], ['G', 'G', '1', 175], ['H', 'G', '0'], ['H', 'D', '1'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest03
  example(
    'minimizacao-03',
    'Minimização 3',
    'AFD de 9 estados (C, F e I finais) que vira um mínimo de 3 estados.',
    [
      ['A', 101, 100, 'i'], ['B', 251, 100], ['C', 401, 100, 'f'], ['D', 551, 100], ['E', 101, 250],
      ['F', 251, 250, 'f'], ['G', 401, 250], ['H', 551, 250], ['I', 101, 400, 'f'],
    ],
    [
      ['A', 'B', '0'], ['A', 'E', '1', -0.16], ['B', 'C', '0'], ['B', 'F', '1', 0.09],
      ['C', 'D', '0'], ['C', 'H', '1', 0.11], ['D', 'E', '0', 0.44], ['D', 'H', '1'],
      ['E', 'F', '0', -0.13], ['E', 'I', '1', -0.12], ['F', 'G', '0'], ['F', 'B', '1', 0.11],
      ['G', 'H', '0'], ['G', 'B', '1'], ['H', 'I', '0'], ['H', 'C', '1', 0.11],
      ['I', 'A', '0', 0.2], ['I', 'E', '1', -0.09],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest04
  example(
    'minimizacao-04',
    'Minimização 4',
    'AFD de 6 estados (E e F finais) que vira um mínimo de 4 estados.',
    [
      ['A', 75, 150, 'i'], ['B', 175, 150], ['C', 275, 50], ['D', 275, 250], ['E', 375, 150, 'f'],
      ['F', 525, 150, 'f'],
    ],
    [
      ['A', 'B', '0'], ['A', 'A', '1'], ['B', 'C', '0'], ['B', 'D', '1'], ['C', 'E', '0'],
      ['C', 'D', '1'], ['D', 'E', '0'], ['D', 'D', '1', 180], ['E', 'E', '0'],
      ['E', 'F', '1', 0.16], ['F', 'E', '0', 0.17], ['F', 'F', '1'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest05
  example(
    'minimizacao-05',
    'Minimização 5: todos finais',
    'Todos os estados são finais, mas o AFD é parcial: são as transições que faltam que separam os estados.',
    [
      ['A', 100, 175, 'if'], ['B', 250, 100, 'f'], ['C', 250, 250, 'f'], ['D', 400, 100, 'f'],
      ['E', 400, 250, 'f'], ['F', 550, 100, 'f'], ['G', 550, 250, 'f'],
    ],
    [
      ['A', 'B', 'a'], ['A', 'C', 'b'], ['B', 'B', 'a'], ['B', 'D', 'b'], ['C', 'E', 'a'],
      ['C', 'C', 'b'], ['D', 'F', 'a'], ['D', 'D', 'b'], ['E', 'E', 'a'], ['E', 'G', 'b'],
      ['F', 'F', 'a'], ['G', 'G', 'b'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest06
  example(
    'minimizacao-06',
    'Minimização 6',
    'AFD sobre {a,b,c,d,e} em que q1 e q3 são equivalentes, assim como q2 e q4.',
    [
      ['q0', 100, 175, 'i'], ['q1', 250, 100], ['q2', 400, 100, 'f'], ['q3', 250, 250],
      ['q4', 400, 250, 'f'],
    ],
    [
      ['q0', 'q1', 'a'], ['q0', 'q3', 'b'], ['q1', 'q1', 'd'], ['q1', 'q2', 'e'],
      ['q1', 'q3', 'c', 0.15], ['q3', 'q3', 'd', 180], ['q3', 'q4', 'e'], ['q3', 'q1', 'c', 0.15],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest07
  example(
    'minimizacao-07',
    'Minimização 7',
    'AFD sobre {a,b,c}: a ou b, depois c*, depois a ou b.',
    [
      ['q0', 100, 175, 'i'], ['q1', 250, 100], ['q2', 400, 100, 'f'], ['q3', 250, 250],
      ['q4', 400, 250, 'f'],
    ],
    [
      ['q0', 'q1', 'a'], ['q0', 'q3', 'b'], ['q1', 'q1', 'c'], ['q1', 'q2', 'b'], ['q1', 'q4', 'a'],
      ['q3', 'q3', 'c', 180], ['q3', 'q4', 'b'], ['q3', 'q2', 'a'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest08
  example(
    'minimizacao-08',
    'Minimização 8: termina em 011',
    'AFD de 5 estados (A a E) para palavras que terminam em 011. O mínimo tem 4 estados.',
    [
      ['A', 100, 175, 'i'], ['B', 250, 100], ['C', 400, 100], ['D', 250, 250], ['E', 400, 250, 'f'],
    ],
    [
      ['A', 'B', '0'], ['A', 'D', '1'], ['B', 'B', '0'], ['B', 'C', '1', 0.15],
      ['D', 'D', '1', 180], ['D', 'B', '0'], ['C', 'B', '0', 0.15], ['C', 'E', '1'],
      ['E', 'B', '0'], ['E', 'D', '1'],
    ],
  ),
  // FAExamplesForMinimizationTest.createDFAForMinimizationTest09
  example(
    'minimizacao-09',
    'Minimização 9: exatamente um 1',
    'Palavras sobre {0,1} com exatamente um 1. O mínimo tem 3 estados (com o estado morto).',
    [
      ['A', 100, 250, 'i'], ['B', 100, 100], ['C', 250, 250, 'f'], ['D', 250, 100, 'f'],
      ['E', 400, 250, 'f'], ['F', 400, 100],
    ],
    [
      ['A', 'B', '0', 0.14], ['A', 'C', '1'], ['B', 'A', '0', 0.12], ['B', 'D', '1'],
      ['C', 'E', '0'], ['C', 'F', '1'], ['D', 'E', '0'], ['D', 'F', '1'], ['E', 'E', '0', 180],
      ['E', 'F', '1'], ['F', 'F', '01'],
    ],
  ),
  // FAExamplesForRemoveUselessAndInaccessibleStates.createNFA
  example(
    'afn-estados-inuteis',
    'AFN com estados inúteis',
    'Aceita só aaa, mas tem 18 estados: vários são inalcançáveis ou inúteis. Bom para testar a remoção.',
    [
      ['q0', 50, 125, 'i'], ['q1', 350, 125, 'f'], ['q2', 150, 75], ['q3', 250, 75],
      ['q4', 150, 175], ['q5', 250, 175], ['q6', 150, 300], ['q7', 250, 300], ['q8', 350, 300],
      ['q9', 450, 300], ['q10', 550, 300], ['q11', 675, 300], ['q12', 800, 300], ['q13', 450, 50],
      ['q14', 550, 50], ['q15', 475, 125], ['q16', 575, 125], ['q17', 675, 125],
    ],
    [
      ['q0', 'q2', 'a'], ['q0', 'q4', 'a'], ['q2', 'q3', 'a'], ['q4', 'q5', 'a'], ['q5', 'q1', 'a'],
      ['q3', 'q1', 'a'], ['q6', 'q4', 'a'], ['q7', 'q5', 'a'], ['q7', 'q7', 'a', 220],
      ['q8', 'q5', 'a'], ['q9', 'q8', 'a'], ['q9', 'q9', 'a'], ['q10', 'q11', 'a'],
      ['q11', 'q10', 'a'], ['q12', 'q11', 'a'], ['q11', 'q12', 'a'], ['q12', 'q12', 'a'],
      ['q10', 'q1', 'a'], ['q1', 'q15', 'a'], ['q15', 'q16', 'a'], ['q16', 'q15', 'a'],
      ['q16', 'q17', 'a'], ['q17', 'q16', 'a'], ['q17', 'q17', 'a', 55], ['q3', 'q13', 'a'],
      ['q13', 'q14', 'a'], ['q14', 'q13', 'a'], ['q14', 'q14', 'a', 80],
    ],
  ),
];
