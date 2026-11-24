import { simulate } from '../../core/pda';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import type { PDA } from '../../core/pda/types';
import type { TreeNodeLike } from './tree';
import { allOpen, defaultOpen, layoutTree, NODE_H, openBelow, PAD, ROW_H, subtreeSizes, visibleNodes } from './tree';

const pal = PDA_EXAMPLES.find((e) => e.id === 'ap-palindromo-par')!.pda;

/** Árvore cheia: cada nó tem `k` filhos até a profundidade `d`. */
function fullTree(k: number, d: number): TreeNodeLike[] {
  const tree: TreeNodeLike[] = [{ index: 0, parent: null, children: [], depth: 0, status: 'EXPANDED' }];
  for (let h = 0; h < tree.length; h++) {
    const n = tree[h]!;
    if (n.depth >= d) {
      n.status = 'DEAD';
      continue;
    }
    const kids: number[] = [];
    for (let j = 0; j < k; j++) {
      const c: TreeNodeLike = { index: tree.length, parent: n.index, children: [], depth: n.depth + 1, status: 'EXPANDED' };
      tree.push(c);
      kids.push(c.index);
    }
    tree[h] = { ...n, children: kids };
  }
  return tree;
}

describe('árvore de IDs: o que aparece e onde', () => {
  it('tamanho das subárvores', () => {
    const t = fullTree(2, 2);
    expect(Array.from(subtreeSizes(t))).toEqual([7, 3, 3, 1, 1, 1, 1]);
  });

  it('abre níveis inteiros até o orçamento e sempre o caminho', () => {
    const t = fullTree(3, 6);
    const open = defaultOpen(t, [], 40);
    // níveis 0 (1), 1 (3), 2 (9), 3 (27): 1+3+9+27 = 40 nós à vista
    expect(open.size).toBe(1 + 3 + 9);
    const deep = t.find((n) => n.depth === 5)!;
    const path: number[] = [];
    for (let i: number | null = deep.index; i !== null; i = t[i]!.parent) path.unshift(i);
    const withPath = defaultOpen(t, path, 40);
    for (const i of path) expect(withPath.has(i)).toBe(true);
  });

  it('layout: o pai fica no meio dos filhos; cada nível é uma coluna à direita', () => {
    const t = fullTree(2, 2);
    const layout = layoutTree(t, allOpen(t), () => 100, (i) => (i === 0 ? 0 : 40));
    const at = layout.at;
    const root = at.get(0)!;
    const [a, b] = [at.get(1)!, at.get(2)!];
    expect(root.x).toBe(PAD);
    expect(a.x).toBeGreaterThan(root.x + root.w);
    expect(root.y).toBe((a.y + b.y) / 2);
    expect(at.get(3)!.y).toBe(PAD);
    expect(at.get(4)!.y).toBe(PAD + ROW_H);
    expect(layout.height).toBe(PAD * 2 + 3 * ROW_H + NODE_H);
    expect(layout.levels).toBe(3);
  });

  it('nó fechado: os descendentes ficam escondidos e contados', () => {
    const t = fullTree(2, 3);
    const layout = layoutTree(t, new Set([0]), () => 80, () => 30);
    expect(layout.nodes.map((n) => n.index)).toEqual([0, 1, 2]);
    expect(layout.at.get(1)!.hidden).toBe(6);
    const more = openBelow(t, new Set([0]), 1);
    expect(layoutTree(t, more, () => 80, () => 30).nodes.length).toBe(9);
  });

  it('5000 nós: abrir tudo e cortar pela vista é rápido', () => {
    const t = fullTree(2, 11); // 4095 nós
    const t0 = performance.now();
    const layout = layoutTree(t, allOpen(t), () => 120, () => 50);
    const shown = visibleNodes(layout, { x: 0, y: 0, w: 1000, h: 300 });
    expect(layout.nodes.length).toBe(t.length);
    expect(shown.length).toBeLessThan(200);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('funciona com a árvore do núcleo (AP do Exemplo 6.2)', () => {
    const r = simulate(pal as PDA, '1111');
    const layout = layoutTree(r.tree, defaultOpen(r.tree, r.path), () => 100, () => 40);
    for (const i of r.path) expect(layout.at.has(i)).toBe(true);
  });
});
