/**
 * Layout automático para autômatos gerados por algoritmo (ou abertos sem posições).
 *
 *  - camadas por busca em largura (BFS) a partir do estado inicial, da esquerda para a direita;
 *  - estados inalcançáveis numa coluna separada, no fim;
 *  - dentro de cada camada, ordena pelo "baricentro" dos pais (menos cruzamentos);
 *  - curvatura automática para pares de ida e volta e para setas que passariam
 *    por cima de outro estado;
 *  - laços apontam para o lado mais livre do estado.
 *
 * Funciona com qualquer autômato (AF, AP ou MT): só usa estados e setas
 * (`GraphLike`). Função pura: não modifica o autômato recebido.
 * Convenções do contrato (src/core/fa/types.ts):
 *  - `positions` são os CENTROS dos estados, em pixels (y para baixo);
 *  - `curvature` é RELATIVA: deslocamento do meio da curva em relação ao meio da
 *    reta, dividido pela distância entre os centros; positivo = curva para a
 *    esquerda de quem anda de `from` para `to` (ex.: 0.2 = curva suave);
 *  - `loopAngle` em graus, 0 = laço em cima, sentido horário.
 */
import type { GraphLike } from '../core/common';
import type { EdgeLayout, Layout, Point, StateId } from '../core/fa/types';

export const LAYER_GAP = 160;
export const ROW_GAP = 130;
/** Curvatura (relativa) dos pares de ida e volta (mesmo sinal nos dois sentidos → lados opostos). */
export const PAIR_CURVATURE = 0.18;
/** Distância angular mínima (graus) para considerar um lado "livre" para o laço. */
const FREE_ENOUGH = 65;
/** Raio aproximado de um estado, só para saber se uma reta "atravessa" outro estado. */
const CLEARANCE = 40;

type AnyTransition = GraphLike['transitions'][number] & {
  /** AF */
  symbols?: readonly string[];
  /** AP e MT */
  rules?: readonly { read: string }[];
};

/** Menor símbolo lido pela seta (AF: símbolos; AP/MT: o `read` das regras). Só para a ordem do BFS. */
function firstSymbol(t: AnyTransition): string {
  const list = Array.isArray(t.symbols) ? t.symbols : Array.isArray(t.rules) ? t.rules.map((r) => r.read) : [];
  return [...list].sort()[0] ?? '';
}

export function autoLayout(fa: GraphLike): Layout {
  const positions: Record<StateId, Point> = {};
  const edges: Record<string, EdgeLayout> = {};
  if (fa.states.length === 0) return { positions, edges };

  const ids = fa.states.map((s) => s.id);
  const known = new Set(ids);
  const nameOf = new Map(fa.states.map((s) => [s.id, s.name]));

  // vizinhos de saída em ordem estável: menor símbolo, depois nome do destino
  const out = new Map<StateId, StateId[]>();
  const sorted = [...(fa.transitions as readonly AnyTransition[])]
    .filter((t) => known.has(t.from) && known.has(t.to))
    .sort((a, b) => {
      const sa = firstSymbol(a);
      const sb = firstSymbol(b);
      if (sa !== sb) return sa < sb ? -1 : 1;
      const na = nameOf.get(a.to) ?? '';
      const nb = nameOf.get(b.to) ?? '';
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  for (const t of sorted) {
    const list = out.get(t.from) ?? [];
    if (!list.includes(t.to)) list.push(t.to);
    out.set(t.from, list);
  }

  // BFS a partir do inicial (ou do primeiro estado, se não houver inicial)
  const start = fa.states.find((s) => s.initial)?.id ?? ids[0]!;
  const layerOf = new Map<StateId, number>([[start, 0]]);
  const layers: StateId[][] = [[start]];
  const queue: StateId[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const l = layerOf.get(cur)!;
    for (const next of out.get(cur) ?? []) {
      if (layerOf.has(next)) continue;
      layerOf.set(next, l + 1);
      (layers[l + 1] ??= []).push(next);
      queue.push(next);
    }
  }

  // baricentro: ordena cada camada pela posição média dos pais nas camadas anteriores
  const rowOf = new Map<StateId, number>();
  layers[0]!.forEach((id, i) => rowOf.set(id, i));
  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l]!;
    const bary = new Map<StateId, number>();
    layer.forEach((id, i) => {
      const parents = sorted
        .filter((t) => t.to === id && (layerOf.get(t.from) ?? Infinity) < l)
        .map((t) => rowOf.get(t.from) ?? 0);
      bary.set(id, parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : i);
    });
    layer.sort((a, b) => bary.get(a)! - bary.get(b)! || layer.indexOf(a) - layer.indexOf(b));
    layer.forEach((id, i) => rowOf.set(id, i));
  }

  const place = (column: StateId[], x: number) => {
    column.forEach((id, i) => {
      positions[id] = { x, y: Math.round((i - (column.length - 1) / 2) * ROW_GAP) };
    });
  };
  layers.forEach((layer, l) => place(layer, l * LAYER_GAP));

  const unreachable = ids.filter((id) => !layerOf.has(id));
  if (unreachable.length > 0) place(unreachable, layers.length * LAYER_GAP + LAYER_GAP / 2);

  // curvaturas
  const pairs = new Set(fa.transitions.map((t) => `${t.from}\u0000${t.to}`));
  for (const t of fa.transitions) {
    if (!known.has(t.from) || !known.has(t.to) || t.from === t.to) continue;
    if (pairs.has(`${t.to}\u0000${t.from}`)) {
      edges[t.id] = { curvature: PAIR_CURVATURE };
      continue;
    }
    const k = curvatureAvoiding(positions, t.from, t.to);
    if (k !== 0) edges[t.id] = { curvature: k };
  }

  // laços para o lado mais livre
  const draft: Layout = { positions, edges };
  for (const t of fa.transitions) {
    if (t.from === t.to && known.has(t.from)) {
      edges[t.id] = { curvature: 0, loopAngle: bestLoopAngle(fa, draft, t.from) };
    }
  }

  return { positions, edges };
}

/**
 * Curvatura (relativa) para a seta from→to não passar por cima de outro estado:
 * 0 se a reta está livre; senão ~22% da distância (entre 50 e 140 px de "barriga"),
 * para o lado de FORA do desenho (longe do centro dos estados).
 */
export function curvatureAvoiding(positions: Record<StateId, Point>, from: StateId, to: StateId): number {
  const a = positions[from];
  const b = positions[to];
  if (!a || !b || from === to) return 0;
  const blocked = Object.entries(positions).some(
    ([id, p]) => id !== from && id !== to && distanceToSegment(p, a, b) < CLEARANCE,
  );
  if (!blocked) return 0;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return 0;
  const px = Math.min(140, Math.max(50, len * 0.22));
  // curva para FORA do desenho: o lado que se afasta do centro de todos os estados
  const all = Object.values(positions);
  const cx = all.reduce((acc, p) => acc + p.x, 0) / all.length;
  const cy = all.reduce((acc, p) => acc + p.y, 0) / all.length;
  const out = { x: (a.x + b.x) / 2 - cx, y: (a.y + b.y) / 2 - cy };
  const left = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
  let dot = left.x * out.x + left.y * out.y;
  if (Math.abs(dot) < 1) dot = left.y <= 0 ? 1 : -1; // no meio: prefere para cima
  return (Math.sign(dot) * Math.round((px / len) * 1000)) / 1000;
}

/**
 * Ângulo (graus; 0 = em cima, sentido horário) mais longe das setas que chegam
 * ou saem do estado — e da seta de entrada do inicial, que fica à esquerda.
 */
export function bestLoopAngle(fa: GraphLike, layout: Layout, id: StateId): number {
  const c = layout.positions[id];
  if (!c) return 0;
  const used: number[] = [];
  for (const t of fa.transitions) {
    if (t.from === t.to) continue;
    const other = t.from === id ? t.to : t.to === id ? t.from : null;
    if (!other) continue;
    const p = layout.positions[other];
    if (!p) continue;
    used.push(angleOf(c, p));
  }
  if (fa.states.find((s) => s.id === id)?.initial) used.push(270);
  // em cima é o padrão dos livros; só muda se o lado estiver ocupado
  const candidates = [0, 180, 90, 270, 45, 315, 135, 225];
  if (used.length === 0) return 0;
  let best = 0;
  let bestScore = -1;
  for (const cand of candidates) {
    const score = Math.min(...used.map((u) => angularDistance(cand, u)));
    if (score >= FREE_ENOUGH) return cand;
    if (score > bestScore) {
      best = cand;
      bestScore = score;
    }
  }
  return best;
}

/** Ângulo de `p` visto de `c`: 0 = em cima, 90 = direita (tela com y para baixo). */
export function angleOf(c: Point, p: Point): number {
  const deg = (Math.atan2(p.x - c.x, -(p.y - c.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Completa um layout parcial: estados sem posição recebem a posição do autoLayout. */
export function ensureLayout(fa: GraphLike, layout: Layout | undefined): Layout {
  const base = layout ?? { positions: {}, edges: {} };
  // Object.hasOwn: um id como "constructor" não pode achar coisas do protótipo
  const has = (id: StateId) => Object.hasOwn(base.positions, id);
  const missing = fa.states.some((s) => !has(s.id));
  if (!missing && layout) return layout;
  const auto = autoLayout(fa);
  const positions: Record<StateId, Point> = {};
  for (const s of fa.states) positions[s.id] = has(s.id) ? base.positions[s.id]! : auto.positions[s.id]!;
  const edges = layout ? { ...base.edges } : auto.edges;
  return { positions, edges };
}
