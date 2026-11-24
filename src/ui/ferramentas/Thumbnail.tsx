/** Miniatura de um autômato (só a forma: estados, setas, inicial e finais). */
import { memo } from 'react';
import type { GraphLike } from '../../core/common';
import type { Layout, Point } from '../../core/fa/types';

const R = 20;

function edgePath(a: Point, b: Point, curvature: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // encurta para começar/terminar na borda dos círculos
  const ux = dx / len;
  const uy = dy / len;
  const off = curvature * len;
  // normal à esquerda de quem anda de a para b (tela: y para baixo)
  const nx = uy;
  const ny = -ux;
  const cx = (a.x + b.x) / 2 + 2 * off * nx;
  const cy = (a.y + b.y) / 2 + 2 * off * ny;
  const sa = Math.hypot(cx - a.x, cy - a.y) || 1;
  const sb = Math.hypot(cx - b.x, cy - b.y) || 1;
  const p0 = { x: a.x + ((cx - a.x) / sa) * R, y: a.y + ((cy - a.y) / sa) * R };
  const p2 = { x: b.x + ((cx - b.x) / sb) * (R + 3), y: b.y + ((cy - b.y) / sb) * (R + 3) };
  return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

/** `fa`: qualquer autômato (AF, AP ou MT): só os estados e as setas importam. */
function ThumbnailImpl({ fa, layout }: { fa: GraphLike; layout: Layout }) {
  const pts = fa.states.map((s) => layout.positions[s.id] ?? { x: 0, y: 0 });
  if (pts.length === 0) return <svg className="fx-thumb" viewBox="0 0 100 60" aria-hidden />;
  const pad = R + 26;
  const minX = Math.min(...pts.map((p) => p.x)) - pad - 14;
  const maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad - 8;
  const maxY = Math.max(...pts.map((p) => p.y)) + pad;
  const pos = (id: string) => layout.positions[id] ?? { x: 0, y: 0 };

  return (
    <svg
      className="fx-thumb"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {fa.transitions.map((t) => {
        const a = pos(t.from);
        if (t.from === t.to) {
          const ang = ((layout.edges[t.id]?.loopAngle ?? 0) * Math.PI) / 180;
          const cx = a.x + Math.sin(ang) * (R + 9);
          const cy = a.y - Math.cos(ang) * (R + 9);
          return <circle key={t.id} className="fx-thumb-edge" cx={cx} cy={cy} r={11} />;
        }
        return (
          <path key={t.id} className="fx-thumb-edge" d={edgePath(a, pos(t.to), layout.edges[t.id]?.curvature ?? 0)} />
        );
      })}
      {fa.states.map((s) => {
        const p = pos(s.id);
        return (
          <g key={s.id}>
            {s.initial && <path className="fx-thumb-edge" d={`M${p.x - R - 22},${p.y} L${p.x - R - 3},${p.y}`} />}
            <circle className="fx-thumb-node" cx={p.x} cy={p.y} r={R} />
            {s.final && <circle className="fx-thumb-ring" cx={p.x} cy={p.y} r={R - 5} />}
          </g>
        );
      })}
    </svg>
  );
}

export const Thumbnail = memo(ThumbnailImpl);
