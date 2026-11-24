/**
 * Exemplos de MT do YAAS original (Prof. Dr. David Buzatto, GPL v3),
 * convertidos de br/com/davidbuzatto/yaas/model/tm/examples/TMExamples
 * (8 exemplos). Cada operação "X/Y →" do YAAS já é uma regra do Hopcroft.
 *
 * O 1º exemplo é a MT do Exemplo 8.2 do Hopcroft: o createDTM0n1nFinalState
 * do YAAS é a mesma MT, então ficou um exemplo só.
 *
 * O modo de aceitação é o que o YAAS usa no menu (a MT do YAAS não guarda o
 * modo); nos dois exemplos que não estão no menu (createDTMExample e
 * createNTM) é o padrão, por estado final. Σ (`inputAlphabet`) foi informado
 * em todos: o YAAS não tem Σ (o getAlphabet dele junta todos os símbolos
 * lidos, inclusive B, X e Y).
 *
 * Diferenças de comportamento em relação ao YAAS (todas por causa do modelo
 * do Hopcroft ou dos bugs da MT do YAAS; ver oraculo.test.ts):
 *  - mt-laco-infinito: no Hopcroft a MT aceita ASSIM QUE entra num estado
 *    final; o YAAS continua rodando depois de passar pelo final;
 *  - mt-nao-deterministica: o YAAS não simula MT não determinística.
 *
 * O teste examples.test.ts confere cada exemplo com a estrutura gravada pelo
 * oráculo (tools/oraculo/GerarOraculoMT.java -> __fixtures__/oraculo.json).
 *
 * Desenho (igual aos exemplos de AF): `layout.positions` = CENTRO de cada
 * estado; `curvature` relativa ao comprimento da reta (positivo = curva para
 * a esquerda de quem anda de `from` para `to`); `loopAngle` em graus
 * (0 = laço em cima, sentido horário).
 */
import type { EdgeLayout } from '../common';
import type { Layout, StateId, TM, TMAcceptance, TMExample, TMRule } from './types';

/** [nome, x, y, marcas]: marcas 'i' = inicial, 'f' = final. */
type StateSpec = [name: string, x: number, y: number, marks?: string];
/** [de, para, regras "XYD" (lê X, escreve Y, move D = L ou R) separadas por espaço, curvatura ou ângulo do laço]. */
type TransitionSpec = [from: string, to: string, rules: string, shape?: number];
/** Palavras de teste: [palavra, aceita, saída (só nas de aceitação por parada)]. */
type Sample = [word: string, accepted: boolean, output?: string];

function parseRules(spec: string): TMRule[] {
  return spec.split(' ').map((r) => {
    const c = Array.from(r);
    if (c.length !== 3 || (c[2] !== 'L' && c[2] !== 'R')) throw new Error(`regra inválida no exemplo: ${r}`);
    return { read: c[0]!, write: c[1]!, move: c[2] };
  });
}

function example(
  id: string,
  name: string,
  description: string,
  acceptance: TMAcceptance,
  sigma: string,
  states: StateSpec[],
  transitions: TransitionSpec[],
  samples: Sample[],
): TMExample {
  const idOf = new Map<string, StateId>(states.map(([n], i) => [n, `q${i}`]));
  const tm: TM = {
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
    blank: 'B',
    acceptance,
    inputAlphabet: Array.from(sigma),
  };
  const positions: Layout['positions'] = {};
  states.forEach(([, x, y], i) => {
    positions[`q${i}`] = { x, y };
  });
  const edges: Record<string, EdgeLayout> = {};
  transitions.forEach(([from, to, , shape = 0], i) => {
    edges[`t${i}`] = from === to ? { curvature: 0, loopAngle: shape } : { curvature: shape };
  });
  return {
    id,
    name,
    description,
    tm,
    layout: { positions, edges },
    samples: samples.map(([word, accepted, output]) => (output === undefined ? { word, accepted } : { word, accepted, output })),
  };
}

export const TM_EXAMPLES: TMExample[] = [
  // TMExamples.createDTM0n1nFinalState = Exemplo 8.2 do Hopcroft
  example(
    'mt-0n1n',
    'MT: 0ⁿ1ⁿ (Exemplo 8.2)',
    'L = { 0ⁿ1ⁿ | n ≥ 1 }. É a MT do Exemplo 8.2 do Hopcroft (o mesmo exemplo do YAAS). A cada volta ela troca o 0 mais à esquerda por X e o 1 mais à esquerda por Y; quando acabam os 0s, confere que só sobraram Ys e aceita ao entrar em q4. Simule 0011 para ver a sequência de IDs do livro.',
    'FINAL_STATE',
    '01',
    [['q0', 125, 125, 'i'], ['q1', 275, 125], ['q2', 425, 125], ['q3', 125, 275], ['q4', 275, 275, 'f']],
    [
      ['q0', 'q1', '0XR', 0.1], ['q1', 'q1', '00R YYR'], ['q1', 'q2', '1YL', 0.09], ['q2', 'q2', '00L YYL'],
      ['q2', 'q0', 'XXR', 0.14], ['q0', 'q3', 'YYR', -0.09], ['q3', 'q3', 'YYR', 180], ['q3', 'q4', 'BBR', 0.1],
    ],
    [
      ['01', true], ['0011', true], ['000111', true],
      ['', false], ['0', false], ['0010', false], ['0101', false], ['10', false],
    ],
  ),
  // TMExamples.createDTMMonusHalt
  example(
    'mt-monus',
    'MT: monus m ∸ n (por parada)',
    'Calcula m ∸ n = max(m − n, 0), a "subtração própria" do Hopcroft, com aceitação por parada: a entrada 0ᵐ10ⁿ vira 0^(m ∸ n) na fita. Ex.: 0000100 (4 ∸ 2) termina com 00. A cada volta a MT apaga um 0 de m e troca um 0 de n por 1; a resposta é o que sobra na fita quando ela para.',
    'HALT',
    '01',
    [
      ['q0', 123, 149, 'i'], ['q1', 273, 149], ['q2', 423, 149], ['q3', 573, 149], ['q4', 423, 299],
      ['q5', 123, 299], ['q6', 273, 299],
    ],
    [
      ['q0', 'q1', '0BR', 0.06], ['q1', 'q2', '11R', 0.06], ['q1', 'q1', '00R'], ['q0', 'q5', '1BR', -0.07],
      ['q5', 'q5', '0BR 1BR', 180], ['q2', 'q2', '11R'], ['q2', 'q3', '01L', 0.07], ['q2', 'q4', 'BBL', -0.07],
      ['q3', 'q3', '00L 11L'], ['q4', 'q4', '00L 1BL', 180], ['q5', 'q6', 'BBR', 0.06], ['q4', 'q6', 'B0R', -0.06],
      ['q3', 'q0', 'BBR', -0.2],
    ],
    [
      ['0000100', true, '00'], ['0010000', true, ''], ['0001', true, '000'], ['000100', true, '0'],
      ['1000', true, ''], ['', true, ''],
    ],
  ),
  // TMExamples.createDTMInfiniteLoopFinalState
  example(
    'mt-laco-infinito',
    'MT: aceita ao entrar no final (o "laço infinito" do YAAS)',
    'No YAAS, esta MT entra em laço com 01: ela passa pelo final q1 e continua rodando, indo e voltando entre q0 e q1 para sempre. No Hopcroft (seção 8.2.5), a MT aceita ASSIM QUE entra num estado final: aqui 01 é aceita em 2 passos, e a linguagem é a das palavras que têm algum 1. Para ver o laço de verdade, troque a aceitação para "por parada": com 01 a configuração se repete e a simulação para em LAÇO.',
    'FINAL_STATE',
    '01',
    [['q0', 121, 136, 'i'], ['q1', 271, 136, 'f']],
    [
      ['q0', 'q0', '00R'], ['q0', 'q1', '11L', 0.16], ['q1', 'q1', '00R'], ['q1', 'q0', '11L', 0.16],
    ],
    [['1', true], ['01', true], ['0001', true], ['10', true], ['', false], ['0', false], ['000', false]],
  ),
  // TMExamples.createDTMExample
  example(
    'mt-sim-ou-nao',
    'MT: termina em 00? (qs = sim, qn = não)',
    'Anda até o fim da palavra e volta apagando os dois últimos símbolos: para em qs (sim) se eles eram 00 e em qn (não) se não eram. No exemplo do YAAS, qs e qn são os dois finais, então toda palavra é aceita: o que responde a pergunta é o estado em que a MT parou. Para aceitar só as palavras que terminam em 00, desmarque qn como final.',
    'FINAL_STATE',
    '01',
    [
      ['q0', 125, 125, 'i'], ['q1', 275, 125], ['q2', 425, 125], ['q3', 275, 275], ['qs', 575, 125, 'f'],
      ['qn', 425, 275, 'f'],
    ],
    [
      ['q0', 'q1', 'BBL', 0.09], ['q1', 'q2', '0BL', 0.08], ['q2', 'qs', '0BL', 0.07], ['q2', 'qn', '1BL BBL', 0.05],
      ['q1', 'q3', '1BL', -0.06], ['q1', 'qn', 'BBL', -0.06], ['q3', 'qn', '0BL 1BL BBL', -0.08],
      ['q0', 'q0', '00R 11R'],
    ],
    [['00', true], ['100', true], ['01', true], ['0', true], ['', true]],
  ),
  // TMExamples.createDTM01SameFinalState
  example(
    'mt-mesmo-numero-de-0-e-1',
    'MT: mesmo número de 0s e 1s',
    'Palavras com o mesmo número de 0s e de 1s. A MT apaga o 1º símbolo e procura um símbolo do outro tipo para marcar (Y marca um 1, X marca um 0); depois volta ao começo, apaga as marcas que encontrar e repete. Aceita ao entrar em q5, quando só sobrou branco.',
    'FINAL_STATE',
    '01',
    [
      ['q0', 100, 200, 'i'], ['q1', 250, 100], ['q2', 400, 100], ['q3', 250, 300], ['q4', 400, 300],
      ['q5', 450, 200, 'f'],
    ],
    [
      ['q0', 'q0', 'XBR YBR', 335], ['q0', 'q1', '0BR'], ['q0', 'q3', '1BR'], ['q1', 'q2', '1YL'],
      ['q1', 'q1', '00R YYR'], ['q2', 'q2', '00L YYL'], ['q2', 'q0', 'BBR'], ['q3', 'q3', '11R XXR', 180],
      ['q4', 'q4', '11L XXL', 180], ['q3', 'q4', '0XL'], ['q4', 'q0', 'BBR'], ['q0', 'q5', 'BBR'],
    ],
    [
      ['', true], ['01', true], ['10', true], ['0110', true], ['1100', true],
      ['0', false], ['001', false], ['111', false],
    ],
  ),
  // TMExamples.createDTMAnBnCnFinalState
  example(
    'mt-anbncn',
    'MT: aⁿbⁿcⁿ',
    'L = { aⁿbⁿcⁿ | n ≥ 1 }, uma linguagem que não é livre de contexto: nenhum AP a reconhece. A cada volta a MT apaga um a, marca um b com X e um c com Y; no fim confere que só sobraram X e Y.',
    'FINAL_STATE',
    'abc',
    [
      ['q0', 100, 225, 'i'], ['q1', 225, 125], ['q2', 375, 125], ['q3', 525, 125], ['q4', 225, 325],
      ['q5', 375, 325, 'f'],
    ],
    [
      ['q0', 'q1', 'aBR'], ['q1', 'q1', 'XXR aaR'], ['q1', 'q2', 'bXR'], ['q2', 'q2', 'YYR bbR'],
      ['q2', 'q3', 'cYL'], ['q3', 'q3', 'XXL YYL aaL bbL'], ['q3', 'q0', 'BBR'], ['q0', 'q4', 'XBR'],
      ['q4', 'q4', 'XXR YYR'], ['q4', 'q5', 'BBR'],
    ],
    [
      ['abc', true], ['aabbcc', true], ['aaabbbccc', true],
      ['', false], ['aabbc', false], ['abcabc', false], ['acb', false],
    ],
  ),
  // TMExamples.createDTMDivideHalt
  example(
    'mt-divisao',
    'MT: divisão em unário (por parada)',
    'Divide m por n, com aceitação por parada: a entrada 0ᵐ10ⁿ1 termina com ⌊m/n⌋ zeros na fita (o quociente). Ex.: 00001001 (4 ÷ 2) termina com 00. A cada volta a MT marca os n zeros do divisor (X) contra n zeros do dividendo (Y) e acrescenta um 0 ao quociente, depois do último 1. Quando o quociente é 0 (m < n), ou quando n = 0, a MT anda para a direita sobre brancos para sempre: como a aceitação é por parada, essas palavras não são aceitas, mas a simulação só consegue dizer INDEFINIDO, porque não há como provar que ela nunca para (ex.: 0010001, 2 ÷ 3).',
    'HALT',
    '01',
    [
      ['q0', 125, 275, 'i'], ['q1', 275, 275], ['q2', 425, 275], ['q3', 575, 275], ['q4', 725, 275],
      ['q5', 425, 425], ['q6', 575, 425], ['q7', 725, 425], ['q8', 575, 125], ['q9', 725, 125],
      ['q10', 875, 125], ['q11', 1025, 125],
    ],
    [
      ['q0', 'q0', '00R'], ['q0', 'q1', '11R'], ['q1', 'q1', 'XXR'], ['q1', 'q2', '0XL'],
      ['q2', 'q2', '00L 11L XXL'], ['q2', 'q3', 'BBR YYR'], ['q3', 'q4', '0YR'], ['q4', 'q4', '00R 11R'],
      ['q1', 'q5', '11R'], ['q5', 'q6', 'B0L'], ['q5', 'q5', '00R'], ['q6', 'q6', '00L'], ['q6', 'q7', '11L'],
      ['q7', 'q7', 'X0L'], ['q4', 'q1', 'XXR', 0.11], ['q7', 'q1', '11R', 0.29], ['q3', 'q8', '11R'],
      ['q8', 'q8', '00R XXR'], ['q8', 'q9', '1BL'], ['q9', 'q10', 'BBR'], ['q10', 'q10', 'BBR'],
      ['q10', 'q11', '00R'], ['q9', 'q9', '0BL 1BL XBL YBL'],
    ],
    [
      ['00001001', true, '00'], ['000101', true, '000'], ['000001001', true, '00'],
      ['0001001', true, '0'],
    ],
  ),
  // TMExamples.createNTM
  example(
    'mt-nao-deterministica',
    'MTN: contém 00',
    'MT não determinística: em q0 ela anda para a direita e, ao ler um 0, pode "adivinhar" que ali começa um 00 (vai para q1). Aceita as palavras que contêm 00. O YAAS não simula MT não determinística (segue sempre a 1ª regra e nunca aceita); aqui a simulação explora a árvore de IDs em largura.',
    'FINAL_STATE',
    '01',
    [['q0', 100, 150, 'i'], ['q1', 250, 150], ['q2', 400, 150, 'f']],
    [['q0', 'q0', '00R 11R'], ['q0', 'q1', '00R'], ['q1', 'q2', '00R']],
    [['00', true], ['100', true], ['1001', true], ['', false], ['0', false], ['0101', false]],
  ),
];
