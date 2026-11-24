/**
 * Monta um SVG autônomo do autômato (puro: sem DOM), com a MESMA geometria do canvas.
 * Usado por "Exportar SVG" e, desenhado num <canvas>, por "Exportar PNG".
 * Serve para AF, AP e MT (no AP e na MT, o rótulo tem uma regra por linha).
 * Não inclui grade, controles nem destaque.
 */
import type { Automaton } from '../../core/automaton';
import { EPSILON } from '../../core/fa/types';
import type { FA, Layout, Point } from '../../core/fa/types';
import type { EdgeGeometry } from './geometry';
import {
  computeDrawing,
  estimateTextWidth,
  FINAL_RING_GAP,
  ELLIPSIS,
  initialArrowGeometry,
  LABEL_FONT_SIZE,
  LABEL_HEIGHT,
  LABEL_PAD_X,
  labelCenter,
  labelHeight,
  RULE_LINE_HEIGHT,
  STATE_FONT_SIZE,
} from './geometry';
import type { LabelPart } from './rules';
import { lineText } from './rules';

export interface ExportPalette {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  edge: string;
  edgeText: string;
  labelBg: string;
  labelBorder: string;
  epsilon: string;
  muted: string;
}

export interface SvgOptions {
  /** Pinta o fundo (PNG). Sem isso o SVG fica transparente. */
  background?: boolean;
  /** CSS extra dentro de <style> (ex.: @font-face embutida). */
  fontCss?: string;
  /** Mede texto de verdade (canvas); sem isso usa uma estimativa. */
  measure?: (text: string, fontSize: number, weight: number) => number;
  padding?: number;
}

export const EXPORT_FONT = "'Inter Variable', Inter, 'Noto Sans', 'Segoe UI', Roboto, Arial, sans-serif";
const LABEL_H = LABEL_HEIGHT;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

export function buildSvg(src: FA | Automaton, layout: Layout, palette: ExportPalette, opts: SvgOptions = {}) {
  const measure = opts.measure ?? ((text: string, size: number) => estimateTextWidth(text, size));
  const pad = opts.padding ?? 28;
  const drawing = computeDrawing(src, layout);

  const pts: Point[] = [];
  const box = (x: number, y: number, w: number, h: number) => {
    pts.push({ x: x - w / 2, y: y - h / 2 }, { x: x + w / 2, y: y + h / 2 });
  };

  /** Rótulo de várias linhas (uma regra por linha), alinhado à esquerda. */
  const rulesLabel = (lines: readonly LabelPart[][], g: EdgeGeometry): string => {
    const w = Math.max(...lines.map((l) => measure(lineText(l), LABEL_FONT_SIZE, 550))) + 2 * LABEL_PAD_X;
    const h = labelHeight(lines.length);
    const c = labelCenter(g, w, h);
    box(c.x, c.y, w, h);
    const x0 = c.x - w / 2 + LABEL_PAD_X;
    const top = c.y - h / 2 + (LABEL_H - RULE_LINE_HEIGHT) / 2;
    const rows = lines
      .map((parts, i) => {
        const inner = parts
          .map((p) => {
            const fill =
              p.tone === 'eps'
                ? ` fill="${palette.epsilon}" font-weight="650"`
                : p.tone === 'muted'
                  ? ` fill="${palette.muted}"`
                  : p.tone === 'move'
                    ? ` font-size="${LABEL_FONT_SIZE + 4}" font-weight="650"`
                    : '';
            return `<tspan${fill}>${esc(p.text)}</tspan>`;
          })
          .join('');
        return `<tspan x="${n(x0)}" y="${n(top + RULE_LINE_HEIGHT * (i + 0.5))}">${inner}</tspan>`;
      })
      .join('');
    return (
      `<g><rect x="${n(c.x - w / 2)}" y="${n(c.y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="8" ` +
      `fill="${palette.labelBg}" stroke="${palette.labelBorder}"/>` +
      `<text xml:space="preserve" text-anchor="start" dominant-baseline="central" ` +
      `font-size="${LABEL_FONT_SIZE}" font-weight="550" fill="${palette.edgeText}">${rows}</text></g>`
    );
  };

  const edgeParts: string[] = [];
  const arrowParts: string[] = [];
  const labelParts: string[] = [];
  for (const t of drawing.transitions) {
    const g = t.geometry;
    edgeParts.push(`<path d="${g.path}"/>`);
    arrowParts.push(`<path d="${g.arrow}"/>`);
    pts.push(...g.hull);
    if (t.lines) {
      labelParts.push(rulesLabel(t.lines, g));
      continue;
    }
    const symbols = t.tokens;
    const w = measure(t.label, LABEL_FONT_SIZE, 550) + 2 * LABEL_PAD_X;
    const c = labelCenter(g, w, LABEL_H);
    box(c.x, c.y, w, LABEL_H);
    const tspans = symbols
      .map((s, i) => {
        const fill =
          s === EPSILON
            ? ` fill="${palette.epsilon}" font-weight="650"`
            : s === ELLIPSIS
              ? ` fill="${palette.muted}"`
              : '';
        const sep = i < symbols.length - 1 ? `<tspan fill="${palette.muted}">, </tspan>` : '';
        return `<tspan${fill}>${esc(s)}</tspan>${sep}`;
      })
      .join('');
    labelParts.push(
      `<g><rect x="${n(c.x - w / 2)}" y="${n(c.y - LABEL_H / 2)}" width="${n(w)}" height="${LABEL_H}" rx="8" ` +
        `fill="${palette.labelBg}" stroke="${palette.labelBorder}"/>` +
        `<text x="${n(c.x)}" y="${n(c.y)}" text-anchor="middle" dominant-baseline="central" ` +
        `font-size="${LABEL_FONT_SIZE}" font-weight="550" fill="${palette.edgeText}">${tspans}</text></g>`,
    );
  }

  const stateParts: string[] = [];
  for (const s of drawing.states) {
    const { x, y, r } = s.circle;
    pts.push({ x: x - r - 4, y: y - r - 4 }, { x: x + r + 4, y: y + r + 4 });
    let out = '';
    if (s.initial) {
      const a = initialArrowGeometry(s.circle);
      pts.push(...a.hull);
      out +=
        `<path d="${a.path}" fill="none" stroke="${palette.nodeStroke}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="${a.arrow}" fill="${palette.nodeStroke}"/>`;
    }
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r - 1)}" fill="${palette.nodeFill}" stroke="${palette.nodeStroke}" stroke-width="2"/>`;
    if (s.final) {
      out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r - 1 - FINAL_RING_GAP)}" fill="none" stroke="${palette.nodeStroke}" stroke-width="2"/>`;
    }
    const size = s.name.length > 4 ? STATE_FONT_SIZE - 1 : STATE_FONT_SIZE;
    out +=
      `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" dominant-baseline="central" font-size="${size}" ` +
      `font-weight="600" fill="${palette.nodeText}">${esc(s.name)}</text>`;
    stateParts.push(`<g>${out}</g>`);
  }

  let minX = 0;
  let minY = 0;
  let maxX = 200;
  let maxY = 120;
  if (pts.length > 0) {
    minX = Math.min(...pts.map((p) => p.x)) - pad;
    minY = Math.min(...pts.map((p) => p.y)) - pad;
    maxX = Math.max(...pts.map((p) => p.x)) + pad;
    maxY = Math.max(...pts.map((p) => p.y)) + pad;
  }
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${n(minX)} ${n(minY)} ${width} ${height}" font-family="${esc(EXPORT_FONT)}">` +
    (opts.fontCss ? `<style>${opts.fontCss}</style>` : '') +
    (opts.background
      ? `<rect x="${n(minX)}" y="${n(minY)}" width="${width}" height="${height}" fill="${palette.background}"/>`
      : '') +
    `<g fill="none" stroke="${palette.edge}" stroke-width="1.75" stroke-linecap="round">${edgeParts.join('')}</g>` +
    `<g fill="${palette.edge}">${arrowParts.join('')}</g>` +
    `<g>${stateParts.join('')}</g>` +
    `<g>${labelParts.join('')}</g>` +
    `</svg>`;
  return { svg, width, height };
}
