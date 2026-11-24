/**
 * Documentos de exemplo feitos à mão (para prints e para testar a interface).
 * Abra com `?demo=<id>`; `&highlight=q0,q2` liga o destaque (só para print).
 *
 * AF: termina-em-01, enfa. AP: ap-wwr (Exemplo 6.2 do Hopcroft), ap-0n1n.
 * MT: mt-0n1n (Exemplo 8.2 do Hopcroft).
 */
import type { PDAFile, TMFile } from '../../core/automaton';
import { EPSILON } from '../../core/fa/types';
import type { AutomatonFile } from '../../core/fa/types';
import type { PDARule } from '../../core/pda/types';
import type { TMRule } from '../../core/tm/types';

const E = EPSILON;
const st = (id: string, initial = false, final = false) => ({ id, name: id, initial, final });
const pr = (read: string, pop: string, push: string): PDARule => ({ read, pop, push });
const tr = (read: string, write: string, move: 'L' | 'R'): TMRule => ({ read, write, move });

const FA_DEMOS: Record<'termina-em-01' | 'enfa', AutomatonFile> = {
  /** AFD sobre {0,1}: aceita as palavras que terminam em "01". */
  'termina-em-01': {
    format: 'automatos-studio',
    version: 1,
    kind: 'fa',
    name: 'Termina em 01',
    fa: {
      states: [
        { id: 'q0', name: 'q0', initial: true, final: false },
        { id: 'q1', name: 'q1', initial: false, final: false },
        { id: 'q2', name: 'q2', initial: false, final: true },
      ],
      transitions: [
        { id: 't0', from: 'q0', to: 'q0', symbols: ['1'] },
        { id: 't1', from: 'q0', to: 'q1', symbols: ['0'] },
        { id: 't2', from: 'q1', to: 'q1', symbols: ['0'] },
        { id: 't3', from: 'q1', to: 'q2', symbols: ['1'] },
        { id: 't4', from: 'q2', to: 'q1', symbols: ['0'] },
        { id: 't5', from: 'q2', to: 'q0', symbols: ['1'] },
      ],
    },
    layout: {
      positions: { q0: { x: 0, y: 0 }, q1: { x: 200, y: 0 }, q2: { x: 400, y: 0 } },
      edges: {
        t0: { curvature: 0, loopAngle: 0 },
        t2: { curvature: 0, loopAngle: 0 },
        t5: { curvature: 0.3 },
      },
    },
  },

  /** ε-AFN com ida e volta (q1 ⇄ q2), laço com ε (q3) e 5 estados. */
  enfa: {
    format: 'automatos-studio',
    version: 1,
    kind: 'fa',
    name: 'ε-AFN de exemplo',
    fa: {
      states: [
        { id: 'q0', name: 'q0', initial: true, final: false },
        { id: 'q1', name: 'q1', initial: false, final: false },
        { id: 'q2', name: 'q2', initial: false, final: false },
        { id: 'q3', name: 'q3', initial: false, final: true },
        { id: 'q4', name: 'q4', initial: false, final: false },
      ],
      transitions: [
        { id: 't0', from: 'q0', to: 'q0', symbols: ['a'] },
        { id: 't1', from: 'q0', to: 'q1', symbols: [E] },
        { id: 't2', from: 'q1', to: 'q2', symbols: ['b'] },
        { id: 't3', from: 'q2', to: 'q1', symbols: ['a', E] },
        { id: 't4', from: 'q2', to: 'q3', symbols: [E] },
        { id: 't5', from: 'q3', to: 'q3', symbols: ['b', E] },
        { id: 't6', from: 'q1', to: 'q4', symbols: ['a'] },
        { id: 't7', from: 'q4', to: 'q3', symbols: ['a', 'b'] },
      ],
    },
    layout: {
      positions: {
        q0: { x: 0, y: 0 },
        q1: { x: 190, y: 0 },
        q2: { x: 400, y: -70 },
        q3: { x: 600, y: 0 },
        q4: { x: 400, y: 110 },
      },
      edges: {
        t0: { curvature: 0, loopAngle: 0 },
        t5: { curvature: 0, loopAngle: 90 },
      },
    },
  },
};

/**
 * Exemplo 6.2 do Hopcroft: AP para L = { wwᴿ | w em (0+1)* } (palíndromos de
 * tamanho par), por estado final. Z faz o papel do Z0 do livro.
 */
const apWwr: PDAFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'pda',
  name: 'Palíndromos wwᴿ (Exemplo 6.2)',
  pda: {
    states: [st('q0', true), st('q1'), st('q2', false, true)],
    transitions: [
      {
        id: 't0',
        from: 'q0',
        to: 'q0',
        rules: [pr('0', 'Z', '0Z'), pr('1', 'Z', '1Z'), pr('0', '0', '00'), pr('0', '1', '01'), pr('1', '0', '10'), pr('1', '1', '11')],
      },
      { id: 't1', from: 'q0', to: 'q1', rules: [pr(E, 'Z', 'Z'), pr(E, '0', '0'), pr(E, '1', '1')] },
      { id: 't2', from: 'q1', to: 'q1', rules: [pr('0', '0', ''), pr('1', '1', '')] },
      { id: 't3', from: 'q1', to: 'q2', rules: [pr(E, 'Z', 'Z')] },
    ],
    startStackSymbol: 'Z',
    acceptance: 'FINAL_STATE',
  },
  layout: {
    positions: { q0: { x: 0, y: 0 }, q1: { x: 240, y: 0 }, q2: { x: 460, y: 0 } },
    edges: { t0: { curvature: 0, loopAngle: 0 }, t2: { curvature: 0, loopAngle: 0 } },
  },
};

/** AP para { 0ⁿ1ⁿ | n ≥ 0 }, por estado final (o do roteiro de teste do editor). */
const ap0n1n: PDAFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'pda',
  name: '0ⁿ1ⁿ com pilha',
  pda: {
    states: [st('q0', true), st('q1'), st('q2', false, true)],
    transitions: [
      { id: 't0', from: 'q0', to: 'q0', rules: [pr('0', 'Z', '0Z'), pr('0', '0', '00')] },
      { id: 't1', from: 'q0', to: 'q1', rules: [pr('1', '0', '')] },
      { id: 't2', from: 'q1', to: 'q1', rules: [pr('1', '0', '')] },
      { id: 't3', from: 'q1', to: 'q2', rules: [pr(E, 'Z', 'Z')] },
      { id: 't4', from: 'q0', to: 'q2', rules: [pr(E, 'Z', 'Z')] },
    ],
    startStackSymbol: 'Z',
    acceptance: 'FINAL_STATE',
  },
  layout: {
    positions: { q0: { x: 0, y: 0 }, q1: { x: 220, y: 0 }, q2: { x: 440, y: 0 } },
    edges: {
      t0: { curvature: 0, loopAngle: 0 },
      t2: { curvature: 0, loopAngle: 0 },
      t4: { curvature: 0.28 },
    },
  },
};

/**
 * Exemplo 8.2 do Hopcroft: MT para { 0ⁿ1ⁿ | n ≥ 1 } (Figura 8.10), por
 * estado final. Troca cada 0 por X e o 1 correspondente por Y.
 */
const mt0n1n: TMFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'tm',
  name: '0ⁿ1ⁿ (Exemplo 8.2)',
  tm: {
    states: [st('q0', true), st('q1'), st('q2'), st('q3'), st('q4', false, true)],
    transitions: [
      { id: 't0', from: 'q0', to: 'q1', rules: [tr('0', 'X', 'R')] },
      { id: 't1', from: 'q1', to: 'q1', rules: [tr('0', '0', 'R'), tr('Y', 'Y', 'R')] },
      { id: 't2', from: 'q1', to: 'q2', rules: [tr('1', 'Y', 'L')] },
      { id: 't3', from: 'q2', to: 'q2', rules: [tr('0', '0', 'L'), tr('Y', 'Y', 'L')] },
      { id: 't4', from: 'q2', to: 'q0', rules: [tr('X', 'X', 'R')] },
      { id: 't5', from: 'q0', to: 'q3', rules: [tr('Y', 'Y', 'R')] },
      { id: 't6', from: 'q3', to: 'q3', rules: [tr('Y', 'Y', 'R')] },
      { id: 't7', from: 'q3', to: 'q4', rules: [tr('B', 'B', 'R')] },
    ],
    blank: 'B',
    acceptance: 'FINAL_STATE',
    inputAlphabet: ['0', '1'],
  },
  layout: {
    positions: {
      q0: { x: 0, y: 0 },
      q1: { x: 220, y: 0 },
      q2: { x: 440, y: 0 },
      q3: { x: 0, y: 230 },
      q4: { x: 220, y: 230 },
    },
    edges: {
      t1: { curvature: 0, loopAngle: 0 },
      t3: { curvature: 0, loopAngle: 0 },
      t4: { curvature: 0.25 },
      t6: { curvature: 0, loopAngle: 180 },
    },
  },
};

export const DEMOS = {
  ...FA_DEMOS,
  'ap-wwr': apWwr,
  'ap-0n1n': ap0n1n,
  'mt-0n1n': mt0n1n,
};

export const DEMO_IDS = Object.keys(DEMOS);
