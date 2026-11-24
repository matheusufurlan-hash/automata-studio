/** Exportar PNG/SVG no navegador (lê os tokens do tema claro e embute a fonte no PNG). */
import interGreek from '@fontsource-variable/inter/files/inter-greek-wght-normal.woff2?url';
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import type { Automaton } from '../../core/automaton';
import type { FA, Layout } from '../../core/fa/types';
import type { ExportPalette } from './svgExport';
import { buildSvg, EXPORT_FONT } from './svgExport';

/** Lê os tokens CSS do tema claro (a imagem exportada é sempre clara, com fundo branco). */
export function readPalette(): ExportPalette {
  const probe = document.createElement('div');
  probe.dataset.theme = 'light';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const palette: ExportPalette = {
    background: v('--export-bg'),
    nodeFill: v('--node-fill'),
    nodeStroke: v('--node-stroke'),
    nodeText: v('--node-text'),
    edge: v('--edge'),
    edgeText: v('--edge-text'),
    labelBg: v('--label-bg'),
    labelBorder: v('--label-border'),
    epsilon: v('--epsilon'),
    muted: v('--muted'),
  };
  probe.remove();
  return palette;
}

let ctx: CanvasRenderingContext2D | null = null;
function measure(text: string, size: number, weight: number): number {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * size * 0.6;
  ctx.font = `${weight} ${size}px ${EXPORT_FONT}`;
  return ctx.measureText(text).width;
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

let fontCss: Promise<string> | null = null;
/** @font-face com a Inter embutida (a imagem do PNG não enxerga as fontes da página). */
function embeddedFontCss(): Promise<string> {
  fontCss ??= Promise.all([toDataUrl(interLatin), toDataUrl(interGreek)])
    .then(
      ([latin, greek]) =>
        `@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${latin}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD;}` +
        `@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${greek}) format('woff2');unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF;}`,
    )
    .catch(() => '');
  return fontCss;
}

export function exportSvgBlob(fa: FA | Automaton, layout: Layout): Blob {
  const { svg } = buildSvg(fa, layout, readPalette(), { measure });
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`], { type: 'image/svg+xml' });
}

export async function exportPngBlob(fa: FA | Automaton, layout: Layout, scale = 2): Promise<Blob> {
  await document.fonts?.ready;
  const font = await embeddedFontCss();
  const { svg, width, height } = buildSvg(fa, layout, readPalette(), { measure, background: true, fontCss: font });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas indisponível');
    c.scale(scale, scale);
    c.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao gerar o PNG'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
