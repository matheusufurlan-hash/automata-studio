/**
 * Enquadramento que considera os RÓTULOS, não só os estados: no AP e na MT um
 * rótulo pode ter várias linhas (ex.: 6 regras num laço) e o `fitView` do
 * React Flow, que só olha os nós, deixaria o rótulo atrás da barra de cima.
 * O AF continua usando o `fitView` de sempre.
 */
import type { Viewport } from '@xyflow/react';
import type { Automaton } from '../../core/automaton';
import type { Layout } from '../../core/fa/types';
import { computeDrawing, drawingBounds } from './geometry';

/** Folga em px: em cima, a barra de ferramentas e o chip de propriedades; embaixo, zoom e minimapa. */
const PAD = { top: 70, bottom: 84, left: 48, right: 48 };
const MAX_ZOOM = 1.25;
const MIN_ZOOM = 0.2;

/** Viewport que mostra o desenho inteiro numa área de `width` × `height` px. */
export function contentViewport(automaton: Automaton, layout: Layout, width: number, height: number): Viewport | null {
  const b = drawingBounds(computeDrawing(automaton, layout));
  if (!b) return null;
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const availW = Math.max(1, width - PAD.left - PAD.right);
  const availH = Math.max(1, height - PAD.top - PAD.bottom);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, availW / bw, availH / bh));
  return {
    x: PAD.left + (availW - bw * zoom) / 2 - b.minX * zoom,
    y: PAD.top + (availH - bh * zoom) / 2 - b.minY * zoom,
    zoom,
  };
}

/** Tamanho da área do canvas (para enquadrar fora do componente Canvas). */
export function canvasSize(): { width: number; height: number } {
  const el = document.querySelector<HTMLElement>('.ed-canvas');
  return { width: el?.clientWidth ?? 800, height: el?.clientHeight ?? 600 };
}
