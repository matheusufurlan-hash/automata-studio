/**
 * Geometria do desenho (pura, sem React): usada pelo canvas E pela exportação
 * PNG/SVG, para os dois ficarem idênticos.
 *
 * Convenções:
 *  - posições do Layout são CENTROS dos estados;
 *  - `curvature` (EdgeLayout) é RELATIVA: deslocamento do meio da curva em
 *    relação ao meio da reta, dividido pela distância entre os centros;
 *    positivo = para a esquerda de quem anda de `from` para `to` (0.2 = suave);
 *  - `loopAngle` em graus: 0 = em cima, 90 = direita (sentido horário).
 *
 * Serve para os três tipos (AF, AP e MT): no AF o rótulo é uma linha
 * ("a, b, ε"); no AP e na MT é uma regra por linha (ver rules.ts).
 */
import { graphOf } from '../../core/automaton';
import type { Automaton } from '../../core/automaton';
import type { GraphLike } from '../../core/common';
import { EPSILON } from '../../core/fa/types';
import type { FA, Layout, Point, Sym, TransitionId } from '../../core/fa/types';
import { PAIR_CURVATURE } from '../../layout/autoLayout';
import type { LabelPart, RuleLabel } from './rules';
import { ELLIPSIS, pdaRuleParts, ruleLabel, tmRuleParts } from './rules';

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface EdgeGeometry {
  kind: 'straight' | 'curve' | 'loop';
  /** Linha da seta, sem a ponta. */
  path: string;
  /** Ponta da seta (caminho fechado, para preencher). */
  arrow: string;
  /** Ponto de ancoragem do rótulo. */
  label: Point;
  /**
   * Para onde o rótulo "sai" do ponto de ancoragem: (0,0) = centrado na linha;
   * nos laços, a direção do laço (o rótulo fica do lado de fora, encostado).
   */
  labelDir: Point;
  /** Pontos que envolvem a curva (para calcular a área do desenho). */
  hull: Point[];
}

export const MIN_RADIUS = 28;
export const STATE_FONT_SIZE = 15;
export const LABEL_FONT_SIZE = 13;
export const FINAL_RING_GAP = 5;
export const ARROW_LEN = 11;
export const ARROW_WIDTH = 10;
/** Folga entre a ponta da seta e a borda do círculo. */
const TIP_GAP = 1;
export const INITIAL_ARROW_LEN = 36;
const LOOP_SPREAD = 28;
const LOOP_CTRL_SPREAD = 42;
const LOOP_REACH = 64;

export { PAIR_CURVATURE };

/* ---------- vetores ---------- */
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const len = (a: Point) => Math.hypot(a.x, a.y);
const unit = (a: Point): Point => {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Perpendicular à esquerda de quem anda na direção `u` (tela com y para baixo). */
const leftOf = (u: Point): Point => ({ x: u.y, y: -u.x });
/** Direção de um ângulo (0 = em cima, sentido horário). */
const dirOf = (deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
};
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const pt = (p: Point) => `${f(p.x)} ${f(p.y)}`;

/* ---------- texto ---------- */
const NARROW = new Set([...",.;:!|il1{}()[]'\"` "]);
const WIDE = new Set([...'mwMW∅@%']);

/** Largura aproximada do texto (Inter). Serve para o tamanho dos círculos e da exportação. */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) em += 0.3;
    else if (WIDE.has(ch)) em += 0.86;
    else if (ch >= 'A' && ch <= 'Z') em += 0.68;
    else em += 0.6;
  }
  return em * fontSize;
}

/** Raio do círculo de um estado: cresce com o nome (ex.: "{q0,q1,q2}"). */
export function stateRadius(name: string): number {
  return Math.max(MIN_RADIUS, Math.ceil(estimateTextWidth(name, STATE_FONT_SIZE) / 2 + 13));
}

/** Centro da caixa do rótulo (largura w, altura h), seguindo `labelDir`. */
export function labelCenter(g: EdgeGeometry, w: number, h: number): Point {
  return { x: g.label.x + (g.labelDir.x * w) / 2, y: g.label.y + (g.labelDir.y * h) / 2 };
}

export { ELLIPSIS };

function charClass(s: string): string | null {
  if (s.length !== 1) return null;
  if (s >= '0' && s <= '9') return 'digit';
  if (s >= 'a' && s <= 'z') return 'lower';
  if (s >= 'A' && s <= 'Z') return 'upper';
  return null;
}

/**
 * Símbolos para MOSTRAR no rótulo. Sequências de 4 ou mais seguidas viram
 * "0, 1, …, 9" (como no livro), para o rótulo não ficar enorme.
 */
export function labelTokens(input: readonly string[]): string[] {
  // mesma ordem em toda a interface: símbolos em ordem e ε por último
  const symbols = [...input].sort((a, b) =>
    a === b ? 0 : a === EPSILON ? 1 : b === EPSILON ? -1 : a < b ? -1 : 1,
  );
  const out: string[] = [];
  let i = 0;
  while (i < symbols.length) {
    const cls = charClass(symbols[i]!);
    let j = i;
    while (
      cls &&
      j + 1 < symbols.length &&
      charClass(symbols[j + 1]!) === cls &&
      symbols[j + 1]!.charCodeAt(0) === symbols[j]!.charCodeAt(0) + 1
    ) {
      j++;
    }
    if (j - i + 1 >= 4) {
      out.push(symbols[i]!, symbols[i + 1]!, ELLIPSIS, symbols[j]!);
    } else {
      for (let k = i; k <= j; k++) out.push(symbols[k]!);
    }
    i = j + 1;
  }
  return out;
}

/** "a, b, ε" (com sequências compactadas). */
export function labelText(symbols: readonly string[]): string {
  return labelTokens(symbols).join(', ');
}

export const LABEL_HEIGHT = 21;
/** Altura de cada linha de um rótulo de várias linhas (regras do AP/MT). */
export const RULE_LINE_HEIGHT = 17;
export const LABEL_PAD_X = 9;

/** Altura do rótulo com `lines` linhas (1 linha = LABEL_HEIGHT). */
export function labelHeight(lines: number): number {
  return Math.max(1, lines) * RULE_LINE_HEIGHT + (LABEL_HEIGHT - RULE_LINE_HEIGHT);
}

/** Tamanho aproximado da "pílula" do rótulo. Texto com "\n" = várias linhas. */
export function labelSize(text: string): { w: number; h: number } {
  const lines = text.split('\n');
  const w = Math.max(...lines.map((l) => estimateTextWidth(l, LABEL_FONT_SIZE)));
  return { w: w + 2 * LABEL_PAD_X, h: labelHeight(lines.length) };
}

/* ---------- conteúdo do rótulo ---------- */

/** O que vai escrito numa seta: símbolos (AF) ou regras (AP/MT). */
export type EdgeLabel =
  | { kind: 'symbols'; symbols: readonly Sym[]; tokens: string[]; text: string }
  | { kind: 'rules'; rules: RuleLabel; text: string };

/** Aceita um `Automaton` ou, como na rodada 1, um FA puro. */
export function toAutomaton(src: FA | Automaton): Automaton {
  return 'kind' in src ? src : { kind: 'fa', fa: src };
}

/** Rótulo de cada seta do autômato. */
export function edgeLabels(a: Automaton): Map<TransitionId, EdgeLabel> {
  const out = new Map<TransitionId, EdgeLabel>();
  switch (a.kind) {
    case 'fa':
      for (const t of a.fa.transitions) {
        out.set(t.id, { kind: 'symbols', symbols: t.symbols, tokens: labelTokens(t.symbols), text: labelText(t.symbols) });
      }
      break;
    case 'pda':
      for (const t of a.pda.transitions) {
        const rules = ruleLabel(t.rules, pdaRuleParts);
        out.set(t.id, { kind: 'rules', rules, text: rules.text });
      }
      break;
    case 'tm':
      for (const t of a.tm.transitions) {
        const rules = ruleLabel(t.rules, tmRuleParts);
        out.set(t.id, { kind: 'rules', rules, text: rules.text });
      }
      break;
  }
  return out;
}

/* ---------- setas ---------- */

/** Ponta "stealth": triângulo com um entalhe atrás. */
export function arrowHead(tip: Point, dir: Point): string {
  const u = unit(dir);
  const n = leftOf(u);
  const back = sub(tip, mul(u, ARROW_LEN));
  const l = add(back, mul(n, ARROW_WIDTH / 2));
  const r = sub(back, mul(n, ARROW_WIDTH / 2));
  const notch = sub(tip, mul(u, ARROW_LEN * 0.74));
  return `M${pt(tip)} L${pt(l)} L${pt(notch)} L${pt(r)} Z`;
}

/**
 * Seta entre dois estados diferentes: reta (curvature 0) ou curva quadrática.
 * `curvature` é relativa. `labelT` = onde fica o rótulo ao longo da seta (0.5 = no meio).
 */
export function transitionGeometry(a: Circle, b: Circle, curvature: number, labelT = 0.5): EdgeGeometry {
  const d = sub(b, a);
  const u = unit(d);
  const bulge = curvature * len(d); // em px
  if (Math.abs(bulge) < 0.5) {
    const start = add(a, mul(u, a.r));
    const tip = sub(b, mul(u, b.r + TIP_GAP));
    const base = sub(tip, mul(u, ARROW_LEN * 0.7));
    return {
      kind: 'straight',
      path: `M${pt(start)} L${pt(base)}`,
      arrow: arrowHead(tip, u),
      label: add(start, mul(sub(tip, start), labelT)),
      labelDir: { x: 0, y: 0 },
      hull: [start, tip],
    };
  }
  const m = mul(add(a, b), 0.5);
  const c = add(m, mul(leftOf(u), 2 * bulge));
  const start = add(a, mul(unit(sub(c, a)), a.r));
  const tip = add(b, mul(unit(sub(c, b)), b.r + TIP_GAP));
  const endDir = unit(sub(tip, c));
  const base = sub(tip, mul(endDir, ARROW_LEN * 0.7));
  // ponto da curva em t = labelT
  const t = labelT;
  const label = add(add(mul(start, (1 - t) * (1 - t)), mul(c, 2 * (1 - t) * t)), mul(tip, t * t));
  return {
    kind: 'curve',
    path: `M${pt(start)} Q${pt(c)} ${pt(base)}`,
    arrow: arrowHead(tip, endDir),
    label,
    labelDir: { x: 0, y: 0 },
    hull: [start, c, tip],
  };
}

/** Laço de um estado para ele mesmo, na direção `angle`. */
export function loopGeometry(c: Circle, angle: number): EdgeGeometry {
  const p0 = add(c, mul(dirOf(angle - LOOP_SPREAD), c.r));
  const tip = add(c, mul(dirOf(angle + LOOP_SPREAD), c.r + TIP_GAP));
  const reach = c.r + LOOP_REACH;
  const c1 = add(c, mul(dirOf(angle - LOOP_CTRL_SPREAD), reach));
  const c2 = add(c, mul(dirOf(angle + LOOP_CTRL_SPREAD), reach));
  const endDir = unit(sub(tip, c2));
  const base = sub(tip, mul(endDir, ARROW_LEN * 0.7));
  const apex = add(mul(add(p0, tip), 0.125), mul(add(c1, c2), 0.375));
  const out = dirOf(angle);
  return {
    kind: 'loop',
    path: `M${pt(p0)} C${pt(c1)} ${pt(c2)} ${pt(base)}`,
    arrow: arrowHead(tip, endDir),
    label: add(apex, mul(out, 3)),
    labelDir: out,
    hull: [p0, c1, c2, tip],
  };
}

/** Seta curta de entrada do estado inicial (vem da esquerda). */
export function initialArrowGeometry(c: Circle): { path: string; arrow: string; hull: Point[] } {
  const tip = { x: c.x - c.r - TIP_GAP, y: c.y };
  const start = { x: c.x - c.r - INITIAL_ARROW_LEN, y: c.y };
  const base = { x: tip.x - ARROW_LEN * 0.7, y: c.y };
  return { path: `M${pt(start)} L${pt(base)}`, arrow: arrowHead(tip, { x: 1, y: 0 }), hull: [start, tip] };
}

/* ---------- interação ---------- */

/** Curvatura (relativa) que faz o meio da curva passar por `p` (arrastar o rótulo). Perto da reta = 0. */
export function curvatureFromPoint(a: Point, b: Point, p: Point): number {
  const d = sub(b, a);
  const dist = len(d);
  if (dist < 1) return 0;
  const n = leftOf(unit(d));
  const m = mul(add(a, b), 0.5);
  const k = (p.x - m.x) * n.x + (p.y - m.y) * n.y;
  return Math.abs(k) < 8 ? 0 : Math.round((k / dist) * 1000) / 1000;
}

/** Ângulo do laço apontando para `p` (arredondado de 5 em 5 graus). */
export function loopAngleFromPoint(c: Point, p: Point): number {
  const deg = (Math.atan2(p.x - c.x, -(p.y - c.y)) * 180) / Math.PI;
  return ((Math.round(deg / 5) * 5) % 360 + 360) % 360;
}

/** Curvatura usada no desenho: a do layout, ou automática para pares de ida e volta. */
export function effectiveCurvature(stored: number | undefined, hasReverse: boolean): number {
  if (stored && stored !== 0) return stored;
  return hasReverse ? PAIR_CURVATURE : 0;
}

/* ---------- rótulos sem sobreposição ---------- */

export interface LabelItem {
  id: string;
  from: Circle;
  to: Circle;
  loop: boolean;
  curvature: number;
  loopAngle: number;
  text: string;
}

const LABEL_T_CANDIDATES = [0.5, 0.36, 0.64, 0.27, 0.73];
const TALL_LABEL_T_CANDIDATES = [0.5, 0.36, 0.64, 0.27, 0.73, 0.2, 0.8];

/**
 * Escolhe onde fica cada rótulo ao longo da sua seta para não cobrir outro
 * rótulo (ex.: duas setas que se cruzam bem no meio). Laços ficam fixos.
 */
export function resolveLabelTs(items: readonly LabelItem[]): Record<string, number> {
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const result: Record<string, number> = {};
  const hits = (x: number, y: number, w: number, h: number) =>
    placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 3 && Math.abs(p.y - y) < (p.h + h) / 2 + 2);
  for (const it of items) {
    if (!it.loop) continue;
    const { w, h } = labelSize(it.text);
    const c = labelCenter(loopGeometry(it.from, it.loopAngle), w, h);
    placed.push({ x: c.x, y: c.y, w, h });
    result[it.id] = 0.5;
  }
  /** Área coberta (rótulos de várias linhas: escolhe o lugar que menos cobre os outros). */
  const overlap = (x: number, y: number, w: number, h: number) =>
    placed.reduce((sum, p) => {
      const ox = (p.w + w) / 2 + 3 - Math.abs(p.x - x);
      const oy = (p.h + h) / 2 + 2 - Math.abs(p.y - y);
      return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
    }, 0);
  for (const it of items) {
    if (it.loop) continue;
    const { w, h } = labelSize(it.text);
    let chosen = 0.5;
    let pos = transitionGeometry(it.from, it.to, it.curvature, 0.5).label;
    if (it.text.includes('\n')) {
      // AP/MT: rótulo alto precisa de mais opções ao longo da seta
      let best = Infinity;
      for (const t of TALL_LABEL_T_CANDIDATES) {
        const p = transitionGeometry(it.from, it.to, it.curvature, t).label;
        const o = overlap(p.x, p.y, w, h);
        if (o < best) {
          best = o;
          chosen = t;
          pos = p;
        }
        if (o === 0) break;
      }
    } else {
      for (const t of LABEL_T_CANDIDATES) {
        const p = transitionGeometry(it.from, it.to, it.curvature, t).label;
        if (!hits(p.x, p.y, w, h)) {
          chosen = t;
          pos = p;
          break;
        }
      }
    }
    placed.push({ x: pos.x, y: pos.y, w, h });
    result[it.id] = chosen;
  }
  return result;
}

/* ---------- autômato inteiro (exportação) ---------- */

export interface DrawnState {
  id: string;
  name: string;
  circle: Circle;
  initial: boolean;
  final: boolean;
}

export interface DrawnTransition {
  transition: GraphLike['transitions'][number];
  geometry: EdgeGeometry;
  /** Texto do rótulo ("a, b, ε"; no AP/MT, as linhas separadas por "\n"). */
  label: string;
  /** AF: as partes do rótulo (para colorir o ε). AP/MT: vazio. */
  tokens: string[];
  /** AP/MT: uma linha por regra (com "… +N" quando há regras demais). */
  lines?: LabelPart[][];
}

export interface Drawing {
  states: DrawnState[];
  transitions: DrawnTransition[];
}

export function circleOf(src: FA | Automaton, layout: Layout, id: string): Circle | null {
  const s = graphOf(toAutomaton(src)).states.find((x) => x.id === id);
  const p = layout.positions[id];
  if (!s || !p) return null;
  return { x: p.x, y: p.y, r: stateRadius(s.name) };
}

/** Geometria de tudo, na mesma regra do canvas. */
export function computeDrawing(src: FA | Automaton, layout: Layout): Drawing {
  const a = toAutomaton(src);
  const g = graphOf(a);
  const circles = new Map<string, Circle>();
  const states: DrawnState[] = [];
  for (const s of g.states) {
    const p = layout.positions[s.id];
    if (!p) continue;
    const circle = { x: p.x, y: p.y, r: stateRadius(s.name) };
    circles.set(s.id, circle);
    states.push({ id: s.id, name: s.name, circle, initial: s.initial, final: s.final });
  }
  const labels = edgeLabels(a);
  const items = labelItems(a, layout, circles, labels);
  const ts = resolveLabelTs(items);
  const byId = new Map(g.transitions.map((t) => [t.id, t]));
  const transitions: DrawnTransition[] = items.map((it) => {
    const t = byId.get(it.id)!;
    const geometry = it.loop
      ? loopGeometry(it.from, it.loopAngle)
      : transitionGeometry(it.from, it.to, it.curvature, ts[it.id]);
    const label = labels.get(it.id)!;
    return label.kind === 'symbols'
      ? { transition: t, geometry, label: it.text, tokens: label.tokens }
      : { transition: t, geometry, label: it.text, tokens: [], lines: label.rules.lines };
  });
  return { states, transitions };
}

/** Retângulo que contém o desenho inteiro: estados, setas e rótulos (estimados). */
export function drawingBounds(d: Drawing): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (p: Point) => {
    xs.push(p.x);
    ys.push(p.y);
  };
  for (const s of d.states) {
    const { x, y, r } = s.circle;
    add({ x: x - r - 4, y: y - r - 4 });
    add({ x: x + r + 4, y: y + r + 4 });
    if (s.initial) initialArrowGeometry(s.circle).hull.forEach(add);
  }
  for (const t of d.transitions) {
    t.geometry.hull.forEach(add);
    const { w, h } = labelSize(t.label);
    const c = labelCenter(t.geometry, w, h);
    add({ x: c.x - w / 2, y: c.y - h / 2 });
    add({ x: c.x + w / 2, y: c.y + h / 2 });
  }
  if (xs.length === 0) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Dados de desenho de cada transição (curvatura efetiva, ângulo do laço, texto).
 * `labels`: rótulos já calculados (senão calcula aqui).
 */
export function labelItems(
  src: FA | Automaton,
  layout: Layout,
  circles: Map<string, Circle>,
  labels?: Map<TransitionId, EdgeLabel>,
): LabelItem[] {
  const a = toAutomaton(src);
  const g = graphOf(a);
  const texts = labels ?? edgeLabels(a);
  const pairs = new Set(g.transitions.map((t) => `${t.from}\u0000${t.to}`));
  const items: LabelItem[] = [];
  for (const t of g.transitions) {
    const a = circles.get(t.from);
    const b = circles.get(t.to);
    if (!a || !b) continue;
    const e = layout.edges[t.id];
    const loop = t.from === t.to;
    items.push({
      id: t.id,
      from: a,
      to: b,
      loop,
      curvature: loop ? 0 : effectiveCurvature(e?.curvature, pairs.has(`${t.to}\u0000${t.from}`)),
      loopAngle: e?.loopAngle ?? 0,
      text: texts.get(t.id)?.text ?? '',
    });
  }
  return items;
}
