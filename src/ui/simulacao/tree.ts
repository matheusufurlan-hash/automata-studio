/**
 * Árvore de IDs (funções puras): quais nós aparecem e onde ficam.
 *
 * A árvore é desenhada "deitada", da esquerda para a direita (a raiz à
 * esquerda), para ler cada ramo como a sequência de IDs com ⊢. Cada nível é
 * uma coluna; cada folha à vista ganha uma linha e o pai fica no meio dos
 * filhos. Árvores grandes (até 5000 nós ou mais) começam com poucos níveis
 * abertos e o caminho da resposta; o resto abre com um clique ("+N").
 */
import type { IDStatus } from '../../core/common';

export interface TreeNodeLike {
  index: number;
  parent: number | null;
  children: readonly number[];
  depth: number;
  status: IDStatus;
}

export const NODE_H = 26;
export const ROW_H = 34;
export const PAD = 16;
/** Espaço entre uma coluna e a próxima, além do rótulo da regra. */
export const COL_GAP = 34;
/** Folga do botão "+N" à direita de um nó fechado. */
export const TOGGLE_W = 40;

/** Tamanho de cada subárvore (o próprio nó + descendentes). Filhos vêm depois do pai no array. */
export function subtreeSizes(tree: readonly TreeNodeLike[]): Int32Array {
  const size = new Int32Array(tree.length).fill(1);
  for (let i = tree.length - 1; i > 0; i--) {
    const p = tree[i]!.parent;
    if (p !== null) size[p]! += size[i]!;
  }
  return size;
}

/**
 * Nós abertos no começo: níveis inteiros, a partir da raiz, enquanto couberem
 * em `budget` nós à vista; mais todos os nós do caminho mostrado.
 */
export function defaultOpen(tree: readonly TreeNodeLike[], path: readonly number[], budget = 60): Set<number> {
  const open = new Set<number>();
  if (tree.length === 0) return open;
  let visible = 1;
  let level = [0];
  while (level.length > 0) {
    let add = 0;
    for (const i of level) add += tree[i]!.children.length;
    if (add === 0 || (visible + add > budget && open.size > 0)) break;
    const next: number[] = [];
    for (const i of level) {
      const n = tree[i]!;
      if (n.children.length === 0) continue;
      open.add(i);
      next.push(...n.children);
    }
    visible += add;
    level = next;
  }
  for (const i of path) if (tree[i] && tree[i]!.children.length > 0) open.add(i);
  return open;
}

/** Abre `index` e, se a subárvore for pequena, tudo abaixo dele. */
export function openBelow(tree: readonly TreeNodeLike[], open: ReadonlySet<number>, index: number, budget = 40): Set<number> {
  const next = new Set(open);
  next.add(index);
  const queue = [...(tree[index]?.children ?? [])];
  let shown = queue.length;
  for (let h = 0; h < queue.length; h++) {
    const n = tree[queue[h]!]!;
    if (n.children.length === 0) continue;
    if (shown + n.children.length > budget) break;
    next.add(n.index);
    shown += n.children.length;
    queue.push(...n.children);
  }
  return next;
}

/** Todos os nós com filhos (expandir tudo). */
export function allOpen(tree: readonly TreeNodeLike[]): Set<number> {
  const open = new Set<number>();
  for (const n of tree) if (n.children.length > 0) open.add(n.index);
  return open;
}

export interface LaidNode {
  index: number;
  parent: number | null;
  x: number;
  y: number;
  /** Largura da caixa da ID. */
  w: number;
  depth: number;
  status: IDStatus;
  /** Tem filhos? */
  hasChildren: boolean;
  /** Os filhos estão à vista? */
  open: boolean;
  /** Descendentes escondidos (nó fechado). */
  hidden: number;
  /** Largura do rótulo da regra na ligação com o pai (0 na raiz). */
  ruleW: number;
}

export interface TreeLayout {
  nodes: LaidNode[];
  /** Posição de cada nó à vista, pelo índice na árvore. */
  at: Map<number, LaidNode>;
  width: number;
  height: number;
  /** Quantos níveis aparecem. */
  levels: number;
}

/**
 * Posições dos nós à vista. `width(i)` = largura da caixa da ID do nó i;
 * `ruleWidth(i)` = largura do rótulo da regra que leva até ele.
 */
export function layoutTree(
  tree: readonly TreeNodeLike[],
  open: ReadonlySet<number>,
  width: (i: number) => number,
  ruleWidth: (i: number) => number,
): TreeLayout {
  const at = new Map<number, LaidNode>();
  if (tree.length === 0) return { nodes: [], at, width: 0, height: 0, levels: 0 };
  const sizes = subtreeSizes(tree);

  // nós à vista, em profundidade (o 1º filho em cima)
  const order: number[] = [];
  const stack = [0];
  while (stack.length > 0) {
    const i = stack.pop()!;
    order.push(i);
    const n = tree[i]!;
    if (open.has(i)) for (let k = n.children.length - 1; k >= 0; k--) stack.push(n.children[k]!);
  }

  // colunas: a mais larga de cada nível define onde começa o próximo
  const colW: number[] = [];
  const gapW: number[] = [];
  const nodes: LaidNode[] = order.map((i) => {
    const n = tree[i]!;
    const isOpen = open.has(i) && n.children.length > 0;
    const w = width(i);
    const rw = n.parent === null ? 0 : ruleWidth(i);
    const hidden = isOpen ? 0 : sizes[i]! - 1;
    colW[n.depth] = Math.max(colW[n.depth] ?? 0, w + (hidden > 0 ? TOGGLE_W : 0));
    gapW[n.depth] = Math.max(gapW[n.depth] ?? 0, rw);
    const node: LaidNode = {
      index: i,
      parent: n.parent,
      x: 0,
      y: 0,
      w,
      depth: n.depth,
      status: n.status,
      hasChildren: n.children.length > 0,
      open: isOpen,
      hidden,
      ruleW: rw,
    };
    at.set(i, node);
    return node;
  });
  const colX: number[] = [];
  let x = PAD;
  for (let d = 0; d < colW.length; d++) {
    if (d > 0) x += (gapW[d] ?? 0) + COL_GAP;
    colX[d] = x;
    x += colW[d] ?? 0;
  }

  // linhas: cada folha à vista ganha uma, de cima para baixo; depois, em ordem
  // reversa (os filhos já têm linha), o pai fica no meio do 1º e do último filho
  const row = new Map<number, number>();
  let next = 0;
  for (const i of order) {
    const n = tree[i]!;
    if (!(open.has(i) && n.children.length > 0)) row.set(i, next++);
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    const n = tree[i]!;
    if (open.has(i) && n.children.length > 0) {
      const first = row.get(n.children[0]!)!;
      const last = row.get(n.children[n.children.length - 1]!)!;
      row.set(i, (first + last) / 2);
    }
  }

  let maxX = 0;
  for (const node of nodes) {
    node.x = colX[node.depth]!;
    node.y = PAD + row.get(node.index)! * ROW_H;
    maxX = Math.max(maxX, node.x + node.w + (node.hidden > 0 ? TOGGLE_W : 0));
  }
  return {
    nodes,
    at,
    width: maxX + PAD,
    height: PAD * 2 + Math.max(0, next - 1) * ROW_H + NODE_H,
    levels: colW.length,
  };
}

/** Os nós que cruzam o retângulo à vista (com folga): só eles são desenhados. */
export function visibleNodes(layout: TreeLayout, view: { x: number; y: number; w: number; h: number }, margin = 160): LaidNode[] {
  const x0 = view.x - margin;
  const x1 = view.x + view.w + margin;
  const y0 = view.y - margin;
  const y1 = view.y + view.h + margin;
  return layout.nodes.filter((n) => {
    // um nó aparece se ele ou a ligação com o pai cruza a vista
    const parent = n.parent === null ? null : layout.at.get(n.parent);
    const left = parent ? parent.x + parent.w : n.x;
    const top = parent ? Math.min(parent.y, n.y) : n.y;
    const bottom = parent ? Math.max(parent.y, n.y) + NODE_H : n.y + NODE_H;
    return n.x + n.w + TOGGLE_W >= x0 && left <= x1 && bottom >= y0 && top <= y1;
  });
}
