/**
 * Aresta "transição": reta, curva ou laço, com rótulo "a, b, ε" (AF) ou uma
 * regra por linha (AP: "0, Z/0Z"; MT: "0/X →").
 * Arrastar o rótulo ajusta a curva (ou gira o laço); duplo clique edita.
 */
import { memo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import { EPSILON } from '../../core/fa/types';
import type { Sym } from '../../core/fa/types';
import { useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { useHighlight } from '../../store/highlight';
import type { Circle, EdgeLabel } from './geometry';
import {
  curvatureFromPoint,
  ELLIPSIS,
  labelText,
  labelTokens,
  loopAngleFromPoint,
  loopGeometry,
  transitionGeometry,
} from './geometry';
import type { LabelPart } from './rules';

export type TransitionEdgeData = {
  from: Circle;
  to: Circle;
  /** O que vai escrito: símbolos (AF) ou regras (AP/MT). */
  label: EdgeLabel;
  curvature: number;
  loopAngle: number;
  /** Curvatura guardada no layout (0 = automática). */
  storedCurvature: number;
  /** Posição do rótulo ao longo da seta (0.5 = meio), escolhida para não cobrir outro rótulo. */
  labelT: number;
};
export type TransitionEdgeType = Edge<TransitionEdgeData, 'transition'>;

interface DragPreview {
  curvature?: number;
  loopAngle?: number;
}

export function SymbolsText({ symbols }: { symbols: readonly Sym[] }) {
  const tokens = labelTokens(symbols);
  return (
    <>
      {tokens.map((s, i) => (
        <span key={`${i}-${s}`}>
          <span className={s === EPSILON ? 'eps' : s === ELLIPSIS ? 'ell' : undefined}>{s}</span>
          {i < tokens.length - 1 && <span className="sep">,</span>}
        </span>
      ))}
    </>
  );
}

/** Uma regra por linha (AP/MT). `used`: linhas da regra usada no passo da simulação. */
export function RuleLines({ lines, used }: { lines: readonly LabelPart[][]; used?: ReadonlySet<number> }) {
  return (
    <>
      {lines.map((parts, i) => (
        <span key={i} className={used?.has(i) ? 'tr-rule is-used' : 'tr-rule'}>
          {parts.map((p, j) => (
            <span key={j} className={p.tone}>
              {p.text}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

function TransitionEdgeImpl({ id, source, target, data, selected }: EdgeProps<TransitionEdgeType>) {
  const { screenToFlowPosition } = useReactFlow();
  const lit = useHighlight((h) => h.transitions.includes(id));
  const status = useHighlight((h) => h.status);
  // AP/MT: índices das regras desta seta usadas no passo ("0,2"; texto para comparar fácil)
  const usedRules = useHighlight((h) =>
    (h.rules ?? [])
      .filter((r) => r.transition === id)
      .map((r) => r.rule)
      .join(','),
  );
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; preview: DragPreview | null } | null>(null);

  if (!data) return null;
  const isLoop = source === target;
  const curvature = preview?.curvature ?? data.curvature;
  const loopAngle = preview?.loopAngle ?? data.loopAngle;
  // arrastando: o rótulo vai para o meio, para seguir o mouse
  const g = isLoop
    ? loopGeometry(data.from, loopAngle)
    : transitionGeometry(data.from, data.to, curvature, preview ? 0.5 : data.labelT);
  const label = data.label;
  const rules = label.kind === 'rules' ? label.rules : null;
  const symbols = label.kind === 'symbols' ? label.symbols : [];
  const compact = rules ? rules.compact : labelText(symbols) !== symbols.join(', ');
  const full = rules ? rules.full : symbols.join(', ');
  // linhas do rótulo com a regra usada (a linha "… +N" acende se a regra usada estiver escondida)
  let usedLines: Set<number> | undefined;
  if (rules && usedRules) {
    const used = usedRules.split(',').map(Number);
    const shown = rules.ruleOf.filter((x) => x !== null).length;
    usedLines = new Set(
      rules.ruleOf.flatMap((ri, line) => ((ri === null ? used.some((u) => u >= shown) : used.includes(ri)) ? [line] : [])),
    );
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, preview: null };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    d.preview = isLoop
      ? { loopAngle: loopAngleFromPoint(data.from, p) }
      : { curvature: curvatureFromPoint(data.from, data.to, p) };
    setPreview(d.preview);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && d.preview) {
      const docs = useDocuments.getState();
      if (isLoop) docs.setEdgeLayout(id, { curvature: 0, loopAngle: d.preview.loopAngle ?? 0 });
      else docs.setEdgeLayout(id, { curvature: d.preview.curvature ?? 0 });
      setPreview(null);
      return;
    }
    // clique simples: seleciona
    const ui = useEditorUi.getState();
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const has = ui.selection.transitions.includes(id);
      ui.select({
        transitions: has ? ui.selection.transitions.filter((t) => t !== id) : [...ui.selection.transitions, id],
      });
    } else {
      ui.select({ states: [], transitions: [id] });
    }
  };

  const cls = ['tr'];
  if (lit) cls.push('hl-on', `hl-${status === 'idle' ? 'running' : status}`);

  return (
    <g className={cls.join(' ')}>
      <path className="tr-hit" d={g.path} />
      <path className="tr-line" d={g.path} />
      <path className="tr-arrow" d={g.arrow} />
      {lit && <path className="tr-flow" d={g.path} />}
      <EdgeLabelRenderer>
        <div
          className={[
            'tr-label nodrag nopan',
            rules ? 'is-rules' : '',
            selected ? 'is-selected' : '',
            preview ? 'is-dragging' : '',
            lit ? `hl-on hl-${status === 'idle' ? 'running' : status}` : '',
          ].join(' ')}
          style={{
            transform:
              `translate(${g.label.x}px, ${g.label.y}px) ` +
              `translate(${-50 + g.labelDir.x * 50}%, ${-50 + g.labelDir.y * 50}%)`,
          }}
          data-edge={id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setPreview(null);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            useEditorUi.getState().openDialog({
              kind: 'transition',
              from: source,
              to: target,
              transitionId: id,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const ui = useEditorUi.getState();
            if (!ui.selection.transitions.includes(id)) ui.select({ states: [], transitions: [id] });
            ui.openMenu({ kind: 'transition', id, x: e.clientX, y: e.clientY });
          }}
          title={
            (compact ? `${full}\n` : '') +
            (isLoop ? 'Arraste para girar o laço · duplo clique para editar' : 'Arraste para curvar · duplo clique para editar')
          }
        >
          {rules ? <RuleLines lines={rules.lines} used={usedLines} /> : <SymbolsText symbols={symbols} />}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}

export const TransitionEdge = memo(TransitionEdgeImpl);
