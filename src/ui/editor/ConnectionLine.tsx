/** Prévia da transição enquanto o usuário arrasta da borda de um estado. */
import type { ConnectionLineComponentProps, InternalNode } from '@xyflow/react';
import { graphOf } from '../../core/automaton';
import { bestLoopAngle } from '../../layout/autoLayout';
import { getActiveDoc } from '../../store/documents';
import type { Circle } from './geometry';
import { arrowHead, loopGeometry, transitionGeometry } from './geometry';

function circleOf(n: InternalNode): Circle {
  const w = n.measured.width ?? 56;
  const h = n.measured.height ?? 56;
  return { x: n.internals.positionAbsolute.x + w / 2, y: n.internals.positionAbsolute.y + h / 2, r: w / 2 };
}

export function ConnectionLine({ fromNode, toNode, toX, toY }: ConnectionLineComponentProps) {
  const a = circleOf(fromNode);
  let path: string;
  let arrow: string;
  if (toNode && toNode.id === fromNode.id) {
    // mesmo lado que o laço vai ganhar ao ser criado (o mais livre)
    const doc = getActiveDoc();
    const g = loopGeometry(a, bestLoopAngle(graphOf(doc.automaton), doc.layout, fromNode.id));
    path = g.path;
    arrow = g.arrow;
  } else if (toNode) {
    const g = transitionGeometry(a, circleOf(toNode), 0);
    path = g.path;
    arrow = g.arrow;
  } else {
    const dx = toX - a.x;
    const dy = toY - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d <= a.r + 4) return null;
    const ux = dx / d;
    const uy = dy / d;
    path = `M${a.x + ux * a.r} ${a.y + uy * a.r} L${toX - ux * 8} ${toY - uy * 8}`;
    arrow = arrowHead({ x: toX, y: toY }, { x: ux, y: uy });
  }
  return (
    <g>
      <path className="conn-line" d={path} />
      <path className="conn-arrow" d={arrow} />
    </g>
  );
}
