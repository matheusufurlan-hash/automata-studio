import { describe, expect, it } from 'vitest';
import { EPSILON } from '../../core/fa/types';
import { DEMOS } from './demos';
import {
  computeDrawing,
  LABEL_HEIGHT,
  labelHeight,
  labelSize,
  curvatureFromPoint,
  labelText,
  labelTokens,
  resolveLabelTs,
  effectiveCurvature,
  loopAngleFromPoint,
  loopGeometry,
  MIN_RADIUS,
  PAIR_CURVATURE,
  stateRadius,
  transitionGeometry,
} from './geometry';
import { parseSymbols, symbolsToText } from './symbols';

describe('geometria', () => {
  it('reta sai e chega nas bordas dos círculos', () => {
    const g = transitionGeometry({ x: 0, y: 0, r: 30 }, { x: 200, y: 0, r: 30 }, 0);
    expect(g.kind).toBe('straight');
    expect(g.path.startsWith('M30 0')).toBe(true);
    expect(g.label).toEqual({ x: 99.5, y: 0 });
  });

  it('curvatura positiva curva para a esquerda de quem anda (para cima, indo para a direita)', () => {
    // curvatura relativa: 0.2 × 200 px = 40 px de "barriga"
    const g = transitionGeometry({ x: 0, y: 0, r: 30 }, { x: 200, y: 0, r: 30 }, 0.2);
    expect(g.kind).toBe('curve');
    expect(g.label.y).toBeLessThan(-30);
    // arrastar o rótulo para o mesmo ponto devolve a mesma curvatura
    expect(curvatureFromPoint({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: -40 })).toBe(0.2);
    // indo para a esquerda, positivo curva para baixo (a esquerda de quem anda)
    const back = transitionGeometry({ x: 200, y: 0, r: 30 }, { x: 0, y: 0, r: 30 }, 0.2);
    expect(back.label.y).toBeGreaterThan(30);
    expect(curvatureFromPoint({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 3 })).toBe(0);
  });

  it('laço em cima do estado (ângulo 0) e ângulo pelo ponto', () => {
    const g = loopGeometry({ x: 0, y: 0, r: 30 }, 0);
    expect(g.kind).toBe('loop');
    expect(g.label.y).toBeLessThan(-30);
    expect(Math.abs(g.label.x)).toBeLessThan(0.5);
    expect(loopAngleFromPoint({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(loopAngleFromPoint({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(180);
  });

  it('par de ida e volta curva sozinho; curvatura guardada vence', () => {
    expect(effectiveCurvature(0, true)).toBe(PAIR_CURVATURE);
    expect(effectiveCurvature(undefined, false)).toBe(0);
    expect(effectiveCurvature(-0.3, true)).toBe(-0.3);
  });

  it('raio cresce com o nome', () => {
    expect(stateRadius('q0')).toBe(MIN_RADIUS);
    expect(stateRadius('{q0,q1,q2}')).toBeGreaterThan(MIN_RADIUS);
  });

  it('computeDrawing desenha tudo que tem posição', () => {
    const d = computeDrawing(
      {
        states: [
          { id: 'a', name: 'q0', initial: true, final: false },
          { id: 'b', name: 'q1', initial: false, final: true },
        ],
        transitions: [
          { id: 't1', from: 'a', to: 'b', symbols: ['0'] },
          { id: 't2', from: 'b', to: 'a', symbols: ['1'] },
          { id: 't3', from: 'b', to: 'b', symbols: ['0', EPSILON] },
        ],
      },
      { positions: { a: { x: 0, y: 0 }, b: { x: 160, y: 0 } }, edges: {} },
    );
    expect(d.states).toHaveLength(2);
    expect(d.transitions.map((t) => t.geometry.kind)).toEqual(['curve', 'curve', 'loop']);
    expect(d.transitions[2]!.label).toBe('0, ε');
  });
});

describe('rótulos', () => {
  it('compacta sequências de 4 ou mais', () => {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    expect(labelText(digits)).toBe('0, 1, …, 9');
    expect(labelText(['+', '-', EPSILON])).toBe('+, -, ε');
    expect(labelText(['a', 'b', 'c'])).toBe('a, b, c');
    expect(labelTokens(['a', 'b', 'c', 'd', 'x', EPSILON])).toEqual(['a', 'b', '…', 'd', 'x', EPSILON]);
  });

  it('rótulos de setas que se cruzam no meio não ficam um em cima do outro', () => {
    const c = (x: number, y: number) => ({ x, y, r: 28 });
    const items = [
      { id: 'a', from: c(0, 0), to: c(200, 200), loop: false, curvature: 0, loopAngle: 0, text: '1' },
      { id: 'b', from: c(200, 0), to: c(0, 200), loop: false, curvature: 0, loopAngle: 0, text: '1' },
    ];
    const ts = resolveLabelTs(items);
    expect(ts.a).toBe(0.5);
    expect(ts.b).not.toBe(0.5);
  });
});

describe('símbolos', () => {
  it('cada caractere é um símbolo; espaços e vírgulas são ignorados', () => {
    expect(parseSymbols('ab, c')).toEqual(['a', 'b', 'c']);
    expect(parseSymbols(' b,a  b ')).toEqual(['a', 'b']);
    expect(parseSymbols(`0${EPSILON}1`)).toEqual(['0', '1', EPSILON]);
    expect(parseSymbols('')).toEqual([]);
  });
  it('symbolsToText', () => {
    expect(symbolsToText(['a', 'b', EPSILON])).toBe('a, b, ε');
  });
});

describe('rótulos de AP e MT (uma regra por linha)', () => {
  it('a altura cresce com as linhas; 1 linha = rótulo do AF', () => {
    expect(labelSize('a, b').h).toBe(LABEL_HEIGHT);
    expect(labelHeight(1)).toBe(LABEL_HEIGHT);
    const two = labelSize('0, Z/0Z\n1, Z/1Z');
    expect(two.h).toBe(labelHeight(2));
    expect(two.h).toBeGreaterThan(LABEL_HEIGHT);
    expect(two.w).toBe(labelSize('0, Z/0Z').w);
  });

  it('computeDrawing de um AP e de uma MT', () => {
    const ap = DEMOS['ap-wwr'];
    const d = computeDrawing({ kind: 'pda', pda: ap.pda }, ap.layout);
    expect(d.states).toHaveLength(3);
    const loop = d.transitions.find((t) => t.transition.id === 't0')!;
    expect(loop.geometry.kind).toBe('loop');
    expect(loop.lines).toHaveLength(6);
    expect(loop.label.split('\n')[0]).toBe('0, Z/0Z');
    expect(loop.tokens).toEqual([]);
    const mt = DEMOS['mt-0n1n'];
    const m = computeDrawing({ kind: 'tm', tm: mt.tm }, mt.layout);
    expect(m.transitions.find((t) => t.transition.id === 't2')!.label).toBe('1/Y ←');
  });

  it('rótulos altos lado a lado não ficam um em cima do outro', () => {
    const c = (x: number, y: number) => ({ x, y, r: 28 });
    const tall = '0, Z/0Z\n0, 0/00\n1, 0/ε\nε, Z/Z';
    const items = [
      { id: 'a', from: c(0, 0), to: c(200, 200), loop: false, curvature: 0, loopAngle: 0, text: tall },
      { id: 'b', from: c(200, 0), to: c(0, 200), loop: false, curvature: 0, loopAngle: 0, text: tall },
    ];
    const ts = resolveLabelTs(items);
    expect(ts.a).toBe(0.5);
    expect(ts.b).not.toBe(0.5);
  });
});
