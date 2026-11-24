import { describe, expect, it } from 'vitest';
import { DEMOS } from './demos';
import type { ExportPalette } from './svgExport';
import { buildSvg } from './svgExport';

const palette: ExportPalette = {
  background: '#ffffff',
  nodeFill: '#fff',
  nodeStroke: '#333',
  nodeText: '#111',
  edge: '#555',
  edgeText: '#222',
  labelBg: '#fff',
  labelBorder: '#ddd',
  epsilon: '#7c3aed',
  muted: '#888',
};

describe('buildSvg', () => {
  const demo = DEMOS.enfa!;

  it('desenha um círculo por estado e um a mais por final', () => {
    const { svg } = buildSvg(demo.fa, demo.layout, palette);
    const circles = svg.match(/<circle /g)?.length ?? 0;
    const finals = demo.fa.states.filter((s) => s.final).length;
    expect(circles).toBe(demo.fa.states.length + finals);
    for (const s of demo.fa.states) expect(svg).toContain(`>${s.name}</text>`);
  });

  it('pinta ε com a cor própria e só põe fundo quando pedido', () => {
    const plain = buildSvg(demo.fa, demo.layout, palette).svg;
    expect(plain).toContain(`fill="${palette.epsilon}"`);
    expect(plain).not.toContain(`fill="${palette.background}"/>`);
    const png = buildSvg(demo.fa, demo.layout, palette, { background: true }).svg;
    expect(png).toContain(`fill="${palette.background}"/>`);
  });

  it('escapa nomes com caracteres especiais e tem tamanho positivo', () => {
    const fa = { states: [{ id: 'a', name: '<x&y>', initial: true, final: false }], transitions: [] };
    const { svg, width, height } = buildSvg(fa, { positions: { a: { x: 0, y: 0 } }, edges: {} }, palette);
    expect(svg).toContain('&lt;x&amp;y&gt;');
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('AP e MT: uma linha por regra (ε colorido, seta da MT)', () => {
    const ap = DEMOS['ap-wwr'];
    const { svg } = buildSvg({ kind: 'pda', pda: ap.pda }, ap.layout, palette);
    const rules = ap.pda.transitions.reduce((n, t) => n + t.rules.length, 0);
    expect(svg.match(/<tspan x="/g)?.length).toBe(rules);
    expect(svg).toContain(`fill="${palette.epsilon}"`);
    expect(svg).toContain('>0Z</tspan>');
    const mt = DEMOS['mt-0n1n'];
    const out = buildSvg({ kind: 'tm', tm: mt.tm }, mt.layout, palette);
    expect(out.svg).toContain('>→</tspan>');
    expect(out.svg).toContain('>←</tspan>');
    expect(out.width).toBeGreaterThan(0);
  });
});
