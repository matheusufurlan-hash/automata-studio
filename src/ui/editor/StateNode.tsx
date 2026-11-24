/**
 * Nó "estado": círculo (duplo se final), seta de entrada se inicial.
 *  - miolo: arrastar move o estado;
 *  - anel da borda: arrastar cria uma transição;
 *  - durante uma ligação, o estado inteiro vira alvo (inclusive ele mesmo → laço).
 */
import { memo } from 'react';
import { Handle, Position, useConnection } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { FAState } from '../../core/fa/types';
import { useHighlight } from '../../store/highlight';
import { initialArrowGeometry } from './geometry';

export type StateNodeData = { state: FAState; r: number };
export type StateNodeType = Node<StateNodeData, 'state'>;

function StateNodeImpl({ id, data, selected }: NodeProps<StateNodeType>) {
  const { state, r } = data;
  const connecting = useConnection((c) => c.inProgress);
  const isActive = useHighlight((h) => h.active.includes(id));
  const isVia = useHighlight((h) => h.viaEpsilon.includes(id));
  const status = useHighlight((h) => h.status);
  const lit = isActive || isVia;

  const cls = ['st'];
  if (state.final) cls.push('is-final');
  if (selected) cls.push('is-selected');
  if (lit) cls.push('hl-on', `hl-${status === 'idle' ? 'running' : status}`);
  if (isVia) cls.push('hl-via');

  const arrow = state.initial ? initialArrowGeometry({ x: 0, y: 0, r }) : null;

  return (
    <div className={cls.join(' ')} style={{ width: 2 * r, height: 2 * r }} title={state.name.length > 12 ? state.name : undefined}>
      {arrow && (
        <svg className="st-initial" aria-hidden>
          <path d={arrow.path} />
          <path className="head" d={arrow.arrow} />
        </svg>
      )}
      <div className="st-disc" />
      <Handle type="source" id="out" position={Position.Right} className="st-ring" />
      <div className="st-body" />
      <div className={state.name.length > 4 ? 'st-name is-long' : 'st-name'}>{state.name}</div>
      <Handle
        type="target"
        id="in"
        position={Position.Left}
        className={connecting ? 'st-target is-on' : 'st-target'}
        isConnectableStart={false}
      />
    </div>
  );
}

export const StateNode = memo(StateNodeImpl);
