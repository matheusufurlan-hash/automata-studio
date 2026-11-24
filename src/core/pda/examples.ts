/**
 * Exemplos de AP do YAAS original (Prof. Dr. David Buzatto, GPL v3),
 * convertidos de br/com/davidbuzatto/yaas/model/pda/examples/PDAExamples
 * (14 exemplos) para o modelo do Hopcroft.
 *
 * O AP do YAAS usa operações DO_NOTHING / POP / PUSH / REPLACE e um "topo ε"
 * que só casa com a pilha vazia. A tradução para a regra "a, X/γ" do Hopcroft
 * (o 1º símbolo de γ fica no topo), conferida com PDA.processStack:
 *   - DO_NOTHING(X) → γ = X;
 *   - POP(X) → γ = ε;
 *   - REPLACE(X, s1…sn) → γ = sn…s1 (o YAAS empilha s1 primeiro);
 *   - PUSH(X, s1…sn) → γ = sn…s1 X (empilha sem tirar o X).
 * O único exemplo com "topo ε" (ap-transicao-vazia-com-pilha-vazia) foi
 * adaptado mantendo a mesma linguagem; ver a descrição dele.
 *
 * O modo de aceitação de cada exemplo é o que o YAAS usa no menu (o AP do
 * YAAS não guarda o modo). O 1º exemplo é o Exemplo 6.2 do Hopcroft, com as
 * regras na ordem do livro: o createPDAEvenPalindromeFinalState do YAAS é o
 * mesmo AP.
 *
 * O teste examples.test.ts confere cada exemplo com a estrutura gravada pelo
 * oráculo (tools/oraculo/GerarOraculoAP.java -> __fixtures__/oraculo.json).
 *
 * Desenho (igual aos exemplos de AF):
 *  - `layout.positions`: o CENTRO de cada estado, em pixels (o setX1Y1 do
 *    YAAS também é o centro do círculo);
 *  - `curvature`: deslocamento do meio da curva em relação ao meio da reta
 *    entre os centros, dividido pelo comprimento da reta (0 = reta; positivo =
 *    curva para a esquerda de quem anda de `from` para `to`, vendo a tela);
 *  - `loopAngle`: graus, 0 = laço em cima, sentido horário.
 */
import type { EdgeLayout } from '../common';
import { EPSILON } from './types';
import type { Layout, PDA, PDAAcceptance, PDAExample, PDARule, StateId } from './types';

/** [nome, x, y, marcas]: marcas 'i' = inicial, 'f' = final. */
type StateSpec = [name: string, x: number, y: number, marks?: string];
/** [de, para, regras "a,X/γ" separadas por espaço (ε = vazio), curvatura ou ângulo do laço]. */
type TransitionSpec = [from: string, to: string, rules: string, shape?: number];
/** Palavras de teste: as aceitas e as rejeitadas. */
type Samples = [accepted: string[], rejected: string[]];

/** "0,Z/0Z ε,Z/ε" → regras (ε em γ = só desempilha). */
function parseRules(spec: string): PDARule[] {
  return spec.split(' ').map((r) => {
    const c = Array.from(r);
    if (c.length < 4 || c[1] !== ',' || c[3] !== '/') throw new Error(`regra inválida no exemplo: ${r}`);
    const push = c.slice(4).join('');
    return { read: c[0]!, pop: c[2]!, push: push === EPSILON ? '' : push };
  });
}

function example(
  id: string,
  name: string,
  description: string,
  acceptance: PDAAcceptance,
  states: StateSpec[],
  transitions: TransitionSpec[],
  [accepted, rejected]: Samples,
): PDAExample {
  const idOf = new Map<string, StateId>(states.map(([n], i) => [n, `q${i}`]));
  const pda: PDA = {
    states: states.map(([n, , , marks = ''], i) => ({
      id: `q${i}`,
      name: n,
      initial: marks.includes('i'),
      final: marks.includes('f'),
    })),
    transitions: transitions.map(([from, to, rules], i) => ({
      id: `t${i}`,
      from: idOf.get(from)!,
      to: idOf.get(to)!,
      rules: parseRules(rules),
    })),
    startStackSymbol: 'Z',
    acceptance,
  };
  const positions: Layout['positions'] = {};
  states.forEach(([, x, y], i) => {
    positions[`q${i}`] = { x, y };
  });
  const edges: Record<string, EdgeLayout> = {};
  transitions.forEach(([from, to, , shape = 0], i) => {
    edges[`t${i}`] = from === to ? { curvature: 0, loopAngle: shape } : { curvature: shape };
  });
  const samples = [
    ...accepted.map((word) => ({ word, accepted: true })),
    ...rejected.map((word) => ({ word, accepted: false })),
  ];
  return { id, name, description, pda, layout: { positions, edges }, samples };
}

const LINE3: StateSpec[] = [['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200, 'f']];
const LINE3_NO_FINAL: StateSpec[] = [['q0', 100, 200, 'i'], ['q1', 250, 200], ['q2', 400, 200]];

export const PDA_EXAMPLES: PDAExample[] = [
  // PDAExamples.createPDAEvenPalindromeFinalState = Exemplo 6.2 do Hopcroft
  example(
    'ap-palindromo-par',
    'AP: palíndromos de tamanho par (Exemplo 6.2)',
    'L = { wwᴿ | w ∈ {0,1}* }, por estado final. É o Exemplo 6.2 do Hopcroft, com as regras do livro (o mesmo AP do YAAS). Em q0 o AP empilha o que lê; num momento qualquer ele "adivinha" que chegou no meio da palavra e passa para q1 por ε. Em q1 ele desempilha conferindo a segunda metade e, com o Z de volta no topo, vai para o final q2.',
    'FINAL_STATE',
    LINE3,
    [
      ['q0', 'q0', '0,Z/0Z 1,Z/1Z 0,0/00 0,1/01 1,0/10 1,1/11'],
      ['q0', 'q1', 'ε,Z/Z ε,0/0 ε,1/1'],
      ['q1', 'q1', '0,0/ε 1,1/ε'],
      ['q1', 'q2', 'ε,Z/Z'],
    ],
    [['', '00', '0110', '1111', '001100'], ['1', '010', '0101', '0011']],
  ),
  // PDAExamples.createPDA01FinalState
  example(
    'ap-comeca-com-0',
    'AP: começa com 0',
    'Aceita, por estado final, as palavras sobre {0,1} que começam com 0. Com o Z no topo, a única regra é 0, Z/XZ: por isso o 1º símbolo precisa ser 0. Depois sempre há um X na pilha, e o AP pode ir para o final q1 (ε, X/ε) em vários momentos diferentes: é não determinístico.',
    'FINAL_STATE',
    [['q0', 100, 200, 'i'], ['q1', 250, 200, 'f']],
    [
      ['q0', 'q0', '0,X/XX 0,Z/XZ 1,X/X'],
      ['q0', 'q1', 'ε,X/ε'],
      ['q1', 'q1', 'ε,X/ε 1,X/XX 1,Z/ε'],
    ],
    [['0', '01', '0110', '00011'], ['', '1', '10', '1000']],
  ),
  // PDAExamples.createPDA0n1nFinalState
  example(
    'ap-0n1n',
    'AP: 0ⁿ1ⁿ',
    'L = { 0ⁿ1ⁿ | n ≥ 1 }, por estado final. Em q0 o AP empilha um X para cada 0; por ε ele passa para q1, que desempilha um X para cada 1. Só com o Z de volta no topo ele chega ao final q2.',
    'FINAL_STATE',
    LINE3,
    [
      ['q0', 'q0', '0,X/XX 0,Z/XZ'],
      ['q0', 'q1', 'ε,X/X'],
      ['q1', 'q1', '1,X/ε'],
      ['q1', 'q2', 'ε,Z/Z'],
    ],
    [['01', '0011', '000111'], ['', '0', '001', '0101', '10']],
  ),
  // PDAExamples.createPDA01SameFinalState
  example(
    'ap-mesmo-numero-de-0-e-1',
    'AP: mesmo número de 0s e 1s',
    'Palavras sobre {0,1} com o mesmo número de 0s e de 1s, por estado final. A pilha guarda quem está sobrando: um X para cada 0 a mais, um Y para cada 1 a mais. Quando o Z volta ao topo, a contagem empatou e o AP pode ir para o final q1.',
    'FINAL_STATE',
    [['q0', 175, 225, 'i'], ['q1', 325, 225, 'f']],
    [
      ['q0', 'q0', '0,X/XX 0,Y/ε 0,Z/XZ 1,X/ε 1,Y/YY 1,Z/YZ'],
      ['q0', 'q1', 'ε,Z/Z'],
    ],
    [['', '01', '10', '0110', '010011'], ['0', '001', '0111', '1101']],
  ),
  // PDAExamples.createPDAAiBjCkFinalState
  example(
    'ap-aibjck',
    'AP: aⁱbʲcᵏ com i = j ou j = k',
    'L = { aⁱbʲcᵏ | i = j ou j = k }, por estado final. No começo o AP escolhe por ε qual igualdade vai conferir: por q2 e q3 ele confere i = j (e depois aceita quantos c vierem, em q1); por q4, q5 e q6 ele confere j = k. A ida direta de q0 para q1 aceita só c (i = j = 0).',
    'FINAL_STATE',
    [
      ['q0', 100, 225, 'i'], ['q1', 275, 100, 'f'], ['q2', 275, 225], ['q3', 425, 225],
      ['q4', 275, 350, 'f'], ['q5', 425, 350], ['q6', 575, 350],
    ],
    [
      ['q0', 'q1', 'ε,Z/Z', 0.1], ['q0', 'q2', 'ε,Z/Z'], ['q0', 'q4', 'ε,Z/Z', -0.1],
      ['q1', 'q1', 'c,Z/Z'], ['q2', 'q2', 'a,X/XX a,Z/XZ'], ['q4', 'q4', 'a,Z/Z'],
      ['q2', 'q3', 'b,X/ε'], ['q3', 'q3', 'b,X/ε', 25], ['q3', 'q1', 'ε,Z/Z', -0.1],
      ['q4', 'q5', 'b,Z/XZ'], ['q5', 'q5', 'b,X/XX'], ['q5', 'q6', 'c,X/ε'], ['q6', 'q6', 'c,X/ε'],
      ['q6', 'q4', 'ε,Z/ε', 0.15],
    ],
    [['', 'aabbccc', 'abbcc', 'aaa', 'ccc'], ['abbc', 'aabccc', 'ba', 'cba']],
  ),
  // PDAExamples.createPDATest0Double1FinalState
  example(
    'ap-0-vale-dois',
    'AP de teste: cada 0 vale dois X',
    'Um AP de teste do YAAS (Test0Double1), por estado final. Cada 0 empilha dois X e cada 1 tira dois X (o segundo sai por ε, de q1 de volta para q0); com os 1s na frente, a pilha guarda Y. Ele só aceita palavras com o mesmo número de 0s e 1s, mas não todas: quando os 1s estão dois ou mais à frente, cada 0 precisa vir seguido de outro 0 (por isso 110100 é rejeitada). Os estados se chamam q0, q1, q3 e q4, como no YAAS.',
    'FINAL_STATE',
    [['q0', 100, 200, 'i'], ['q1', 225, 100], ['q3', 225, 300], ['q4', 425, 200, 'f']],
    [
      ['q0', 'q0', '0,X/XXX 0,Z/XXZ 1,Y/YY 1,Z/YZ', 335],
      ['q0', 'q1', '1,X/ε', 0.17],
      ['q1', 'q0', 'ε,X/ε ε,Z/YZ', 0.11],
      ['q0', 'q3', '0,Y/ε', 0.13],
      ['q3', 'q0', 'ε,Z/Z 0,Y/ε', 0.16],
      ['q0', 'q4', 'ε,Z/Z'],
    ],
    [['', '01', '0011', '1100', '011010'], ['0', '011', '110100']],
  ),
  // PDAExamples.createPDAEvenPalindromeEmptyStack
  example(
    'ap-palindromo-par-pilha-vazia',
    'AP: palíndromos de tamanho par (pilha vazia)',
    'O AP do Exemplo 6.2 aceitando por pilha vazia: N(P) = { wwᴿ }, com as regras na ordem do livro. A única diferença é a última regra, que vira ε, Z/ε: em vez de ir para um estado final, o AP tira o Z e a pilha fica vazia.',
    'EMPTY_STACK',
    LINE3_NO_FINAL,
    [
      ['q0', 'q0', '0,Z/0Z 1,Z/1Z 0,0/00 0,1/01 1,0/10 1,1/11'],
      ['q0', 'q1', 'ε,Z/Z ε,0/0 ε,1/1'],
      ['q1', 'q1', '0,0/ε 1,1/ε'],
      ['q1', 'q2', 'ε,Z/ε'],
    ],
    [['', '00', '0110', '1111', '001100'], ['1', '010', '0101', '0011']],
  ),
  // PDAExamples.createPDA0n1nEmptyStack
  example(
    'ap-0n1n-pilha-vazia',
    'AP: 0ⁿ1ⁿ (pilha vazia)',
    'L = { 0ⁿ1ⁿ | n ≥ 1 }, aceitando por pilha vazia: no fim, a regra ε, Z/ε tira o Z e a pilha fica vazia.',
    'EMPTY_STACK',
    LINE3_NO_FINAL,
    [
      ['q0', 'q0', '0,X/XX 0,Z/XZ'],
      ['q0', 'q1', 'ε,X/X'],
      ['q1', 'q1', '1,X/ε'],
      ['q1', 'q2', 'ε,Z/ε'],
    ],
    [['01', '0011', '000111'], ['', '0', '001', '0101', '10']],
  ),
  // PDAExamples.createPDA01SameEmptyStack
  example(
    'ap-mesmo-numero-de-0-e-1-pilha-vazia',
    'AP: mesmo número de 0s e 1s (pilha vazia)',
    'Palavras com o mesmo número de 0s e de 1s, aceitando por pilha vazia. A pilha guarda quem está sobrando (X = 0s a mais, Y = 1s a mais); quando o Z volta ao topo, a regra ε, Z/ε esvazia a pilha.',
    'EMPTY_STACK',
    [['q0', 175, 225, 'i'], ['q1', 325, 225]],
    [
      ['q0', 'q0', '0,X/XX 0,Y/ε 0,Z/XZ 1,X/ε 1,Y/YY 1,Z/YZ'],
      ['q0', 'q1', 'ε,Z/ε'],
    ],
    [['', '01', '10', '0110', '010011'], ['0', '001', '0111', '1101']],
  ),
  // PDAExamples.createDPDAEvenPalindromeCenterMark
  example(
    'apd-palindromo-com-marca',
    'APD: wcwᴿ (palíndromo com marca no meio)',
    'L = { wcwᴿ | w ∈ {0,1}* }, por estado final. Com o c marcando o meio, o AP não precisa adivinhar nada: é um AP determinístico (APD, seção 6.4 do Hopcroft).',
    'FINAL_STATE',
    LINE3,
    [
      ['q0', 'q0', '0,0/00 0,1/01 0,Z/0Z 1,0/10 1,1/11 1,Z/1Z'],
      ['q0', 'q1', 'c,0/0 c,1/1 c,Z/Z'],
      ['q1', 'q1', '0,0/ε 1,1/ε'],
      ['q1', 'q2', 'ε,Z/Z'],
    ],
    [['c', '0c0', '01c10', '001c100'], ['', '0c1', '00c0', '0cc0']],
  ),
  // PDAExamples.createDPDA0n1n
  example(
    'apd-0n1n',
    'APD: 0ⁿ1ⁿ',
    'L = { 0ⁿ1ⁿ | n ≥ 1 }, por estado final e sem não determinismo: o primeiro 1 já desempilha um X e leva para q1, então o AP não precisa adivinhar onde acabam os 0s.',
    'FINAL_STATE',
    LINE3,
    [
      ['q0', 'q0', '0,X/XX 0,Z/XZ'],
      ['q0', 'q1', '1,X/ε'],
      ['q1', 'q1', '1,X/ε'],
      ['q1', 'q2', 'ε,Z/Z'],
    ],
    [['01', '0011', '000111'], ['', '0', '001', '0101', '10']],
  ),
  // PDAExamples.createDPDA01Same
  example(
    'apd-diferenca-de-0-e-1',
    'APD: diferença entre 0s e 1s na pilha',
    'Um estado só, inicial e final, com as regras do AP "mesmo número de 0s e 1s": a pilha guarda a diferença (X = sobram 0s, Y = sobram 1s, Z no topo = empate). Atenção: como q0 é final e o APD nunca trava, por estado final ele aceita TODAS as palavras (no YAAS também). Para ver a contagem, siga a pilha na simulação ou compare com o AP "mesmo número de 0s e 1s".',
    'FINAL_STATE',
    [['q0', 175, 225, 'if']],
    [['q0', 'q0', '0,X/XX 0,Y/ε 0,Z/XZ 1,X/ε 1,Y/YY 1,Z/YZ']],
    [['', '0', '01', '111', '010011'], []],
  ),
  // PDAExamples.createPDAEmptyTransitionEmptyStackFinalState (ADAPTADO: o YAAS usa "topo ε")
  example(
    'ap-transicao-vazia-com-pilha-vazia',
    'AP: transições ε com a pilha "vazia" (adaptado)',
    'Aceita só a palavra vazia, por estado final. No YAAS, este exemplo esvaziava a pilha (ε, Z/ε) e depois usava um "topo ε", que só casa com a pilha vazia. O Hopcroft não tem topo ε: com a pilha vazia, nenhuma regra se aplica. Por isso, aqui o Z fica no fundo e faz o papel da pilha vazia, e as duas transições são ε, Z/Z. A linguagem é a mesma: as transições ε nunca leem a entrada, então 0 é rejeitada.',
    'FINAL_STATE',
    LINE3,
    [
      ['q0', 'q1', 'ε,Z/Z'],
      ['q1', 'q2', 'ε,Z/Z'],
    ],
    [[''], ['0']],
  ),
  // PDAExamples.createPDAEmptyTransitionCycleFinalState
  example(
    'ap-ciclo-de-transicoes-vazias',
    'AP: ciclo de transições ε',
    'Aceita só a palavra vazia, por estado final. q0 e q1 formam um ciclo de transições ε que não lê nada e não muda a pilha. A busca em largura marca a ID repetida (q0, ε, Z) como REPEATED e não fica presa no ciclo.',
    'FINAL_STATE',
    [['q0', 150, 200, 'i'], ['q1', 300, 200], ['q2', 450, 200, 'f']],
    [
      ['q0', 'q2', 'ε,Z/Z'],
      ['q0', 'q1', 'ε,Z/Z'],
      ['q1', 'q0', 'ε,Z/Z'],
    ],
    [[''], []],
  ),
];
