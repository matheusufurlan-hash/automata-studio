import { describe, expect, it } from 'vitest';
import type { FA } from '../core/fa/types';
import { autoLayout, bestLoopAngle, ensureLayout, LAYER_GAP, PAIR_CURVATURE } from './autoLayout';

const st = (id: string, initial = false, final = false) => ({ id, name: id, initial, final });
const tr = (id: string, from: string, to: string, ...symbols: string[]) => ({ id, from, to, symbols });

describe('autoLayout', () => {
  it('FA vazio → layout vazio', () => {
    expect(autoLayout({ states: [], transitions: [] })).toEqual({ positions: {}, edges: {} });
  });

  it('camadas por BFS a partir do inicial, da esquerda para a direita', () => {
    const fa: FA = {
      states: [st('c'), st('a', true), st('b'), st('d')],
      transitions: [tr('t1', 'a', 'b', '0'), tr('t2', 'a', 'c', '1'), tr('t3', 'b', 'd', '0'), tr('t4', 'c', 'd', '0')],
    };
    const { positions } = autoLayout(fa);
    expect(positions.a!.x).toBe(0);
    expect(positions.b!.x).toBe(LAYER_GAP);
    expect(positions.c!.x).toBe(LAYER_GAP);
    expect(positions.d!.x).toBe(2 * LAYER_GAP);
    // b vem antes de c (símbolo 0 antes de 1) e os dois ficam centralizados
    expect(positions.b!.y).toBeLessThan(positions.c!.y);
    expect(positions.b!.y + positions.c!.y).toBe(0);
  });

  it('inalcançáveis ficam numa coluna separada no fim', () => {
    const fa: FA = {
      states: [st('a', true), st('b'), st('x'), st('y')],
      transitions: [tr('t1', 'a', 'b', '0'), tr('t2', 'x', 'y', '0')],
    };
    const { positions } = autoLayout(fa);
    const maxReach = Math.max(positions.a!.x, positions.b!.x);
    expect(positions.x!.x).toBeGreaterThan(maxReach + LAYER_GAP / 2);
    expect(positions.x!.x).toBe(positions.y!.x);
    expect(positions.x!.y).not.toBe(positions.y!.y);
  });

  it('pares de ida e volta ganham curvatura automática', () => {
    const fa: FA = {
      states: [st('a', true), st('b')],
      transitions: [tr('t1', 'a', 'b', '0'), tr('t2', 'b', 'a', '1')],
    };
    const { edges } = autoLayout(fa);
    expect(edges.t1?.curvature).toBe(PAIR_CURVATURE);
    expect(edges.t2?.curvature).toBe(PAIR_CURVATURE);
  });

  it('seta que passaria por cima de outro estado vira curva', () => {
    const fa: FA = {
      states: [st('a', true), st('b'), st('c')],
      transitions: [tr('t1', 'a', 'b', '0'), tr('t2', 'b', 'c', '0'), tr('t3', 'c', 'a', '1')],
    };
    const { edges } = autoLayout(fa);
    // relativa: entre 0 e 1, nunca pixels
    expect(Math.abs(edges.t3?.curvature ?? 0)).toBeGreaterThan(0.1);
    expect(Math.abs(edges.t3?.curvature ?? 0)).toBeLessThan(1);
    expect(edges.t1).toBeUndefined();
  });

  it('laço fica no lado livre e o inicial não usa a esquerda', () => {
    const fa: FA = {
      states: [st('a', true), st('b')],
      transitions: [tr('t1', 'a', 'a', '0'), tr('t2', 'a', 'b', '1')],
    };
    const layout = autoLayout(fa);
    const angle = layout.edges.t1?.loopAngle;
    expect(angle).toBe(0);
    expect(bestLoopAngle(fa, layout, 'a')).not.toBe(90);
  });

  it('todas as posições são números e o FA não é modificado', () => {
    const fa: FA = {
      states: [st('a'), st('b'), st('c', false, true)],
      transitions: [tr('t1', 'a', 'b', 'x'), tr('t2', 'b', 'c', 'y'), tr('t3', 'c', 'c', 'z')],
    };
    const copy = JSON.parse(JSON.stringify(fa));
    const { positions } = autoLayout(fa);
    for (const s of fa.states) {
      expect(Number.isFinite(positions[s.id]!.x)).toBe(true);
      expect(Number.isFinite(positions[s.id]!.y)).toBe(true);
    }
    expect(fa).toEqual(copy);
  });

  it('ensureLayout completa só as posições que faltam', () => {
    const fa: FA = { states: [st('a', true), st('b')], transitions: [tr('t1', 'a', 'b', '0')] };
    const out = ensureLayout(fa, { positions: { a: { x: 500, y: 500 } }, edges: { t1: { curvature: 0.1 } } });
    expect(out.positions.a).toEqual({ x: 500, y: 500 });
    expect(out.positions.b).toBeDefined();
    expect(out.edges.t1).toEqual({ curvature: 0.1 });
  });
});
