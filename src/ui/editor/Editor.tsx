/**
 * Editor visual: abas + canvas (@xyflow/react) + menus e janelas.
 * O modelo vem do store `useDocuments`; o canvas só desenha e traduz gestos em ações.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  ViewportPortal,
} from '@xyflow/react';
import type {
  Connection,
  EdgeChange,
  MiniMapNodeProps,
  NodeChange,
  OnConnectEnd,
  Viewport,
} from '@xyflow/react';
import { graphOf } from '../../core/automaton';
import type { AutomatonKind } from '../../core/automaton';
import type { Point } from '../../core/fa/types';
import { getActiveDoc, isEmptyDoc, useActiveDoc, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { useTheme } from '../../store/theme';
import {
  currentSelection,
  deleteSelection,
  redo,
  selectAll,
  setInitialOnSelection,
  toggleFinalOnSelection,
  undo,
} from './actions';
import { bootstrapFromUrl } from './bootstrap';
import { ConnectionLine } from './ConnectionLine';
import { ContextMenus } from './ContextMenus';
import { Dialogs, Toasts } from './Dialogs';
import { contentViewport } from './fitContent';
import { edgeLabels, labelItems, MIN_RADIUS, resolveLabelTs, stateRadius } from './geometry';
import { PropertiesChip } from './Properties';
import type { StateNodeType } from './StateNode';
import { StateNode } from './StateNode';
import { TabBar } from './TabBar';
import { Toolbar, ZoomControls } from './Toolbar';
import type { TransitionEdgeType } from './TransitionEdge';
import { TransitionEdge } from './TransitionEdge';

bootstrapFromUrl();

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };
const GRID = 20;
const DIRECTION_PT_BR: Record<string, string> = {
  up: 'para cima',
  down: 'para baixo',
  left: 'para a esquerda',
  right: 'para a direita',
};
const ARIA_PT_BR = {
  'node.a11yDescription.default':
    'Enter ou espaço seleciona o estado. Delete apaga e Esc cancela.',
  'node.a11yDescription.keyboardDisabled':
    'Enter ou espaço seleciona o estado. Depois, as setas do teclado movem o estado. Delete apaga e Esc cancela.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Estado movido (${DIRECTION_PT_BR[direction] ?? direction}). Nova posição: x ${x}, y ${y}`,
  'edge.a11yDescription.default': 'Enter ou espaço seleciona a transição. Delete apaga e Esc cancela.',
  'minimap.ariaLabel': 'Minimapa',
  'handle.ariaLabel': 'Borda do estado (arraste para criar uma transição)',
};
// margens em px: em cima cabem a barra de ferramentas e os laços com rótulo;
// embaixo, os controles de zoom e o minimapa
const FIT = {
  padding: { top: '104px', bottom: '92px', left: '64px', right: '64px' },
  maxZoom: 1.25,
} as const;

/**
 * Enquadra o autômato da aba ativa: AF com o fitView de sempre; AP e MT
 * contando também os rótulos de várias linhas (ver fitContent.ts).
 */
function fitAll(rf: ReturnType<typeof useReactFlow>, el: HTMLElement | null, duration?: number) {
  const doc = getActiveDoc();
  if (doc.automaton.kind === 'fa') return rf.fitView(duration ? { ...FIT, duration } : FIT);
  const vp = contentViewport(doc.automaton, doc.layout, el?.clientWidth ?? 800, el?.clientHeight ?? 600);
  return vp ? rf.setViewport(vp, duration ? { duration } : undefined) : rf.fitView(FIT);
}

export function Editor() {
  return (
    <ReactFlowProvider>
      <div className="ed-root">
        <TabBar />
        <Canvas />
      </div>
      <ContextMenus />
      <Dialogs />
      <Toasts />
    </ReactFlowProvider>
  );
}

function MiniNode({ x, y, width, selected }: MiniMapNodeProps) {
  const r = width / 2;
  return <circle className={selected ? 'ed-mini-node is-selected' : 'ed-mini-node'} cx={x + r} cy={y + r} r={r} />;
}

function snapPoint(p: Point, on: boolean): Point {
  return on ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID } : p;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Círculo tracejado que segue o mouse quando a ferramenta Estado está ligada. */
function Ghost({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const tool = useEditorUi((s) => s.tool);
  const snap = useEditorUi((s) => s.snap);
  const { screenToFlowPosition } = useReactFlow();
  const [pos, setPos] = useState<Point | null>(null);
  useEffect(() => {
    const el = container.current;
    if (!el || tool !== 'state') return;
    const onMove = (e: PointerEvent) => {
      const over = (e.target as Element | null)?.classList?.contains('react-flow__pane');
      setPos(over ? snapPoint(screenToFlowPosition({ x: e.clientX, y: e.clientY }), snap) : null);
    };
    const onLeave = () => setPos(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      setPos(null);
    };
  }, [container, tool, snap, screenToFlowPosition]);
  if (tool !== 'state' || !pos) return null;
  return (
    <ViewportPortal>
      <div className="ed-ghost" style={{ left: pos.x, top: pos.y, width: 2 * MIN_RADIUS, height: 2 * MIN_RADIUS }} />
    </ViewportPortal>
  );
}

const EMPTY_TEXT: Record<AutomatonKind, { title: string; transition: string; props?: string }> = {
  fa: { title: 'Comece o seu autômato', transition: 'arraste da borda de um estado até outro (ou até ele mesmo)' },
  pda: {
    title: 'Comece o seu autômato com pilha',
    transition: 'arraste da borda de um estado até outro e escreva as regras a, X/γ (ex.: 0, Z/0Z)',
    props: 'Z₀ e o modo de aceitação, no canto de cima',
  },
  tm: {
    title: 'Comece a sua máquina de Turing',
    transition: 'arraste da borda de um estado até outro e escreva as regras X/Y → (ex.: 0/X →)',
    props: 'o branco, o modo de aceitação e Σ, no canto de cima',
  },
};

function EmptyHint({ kind }: { kind: AutomatonKind }) {
  const t = EMPTY_TEXT[kind];
  return (
    <div className="ed-empty">
      <div className="ed-empty-card">
        <div className="ed-empty-icon">q0</div>
        <h3>{t.title}</h3>
        <p>Dê um duplo clique no fundo para criar um estado.</p>
        <div className="ed-empty-tips">
          <b>Estado</b>
          <span>duplo clique, ou a ferramenta Estado (S)</span>
          <b>Transição</b>
          <span>{t.transition}</span>
          {t.props && (
            <>
              <b>Propriedades</b>
              <span>{t.props}</span>
            </>
          )}
          <b>Opções</b>
          <span>clique direito num estado ou numa transição</span>
        </div>
      </div>
    </div>
  );
}

function Canvas() {
  const doc = useActiveDoc();
  const selection = useEditorUi((s) => s.selection);
  const tool = useEditorUi((s) => s.tool);
  const snap = useEditorUi((s) => s.snap);
  const theme = useTheme((s) => s.theme);
  const rf = useReactFlow();
  const [drag, setDrag] = useState<Record<string, Point>>({});
  /** O React Flow já montou o zoom/pan (antes disso fitView não faz nada). */
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pendingConnection = useRef<Connection | null>(null);

  /* ---------- modelo → React Flow ---------- */
  const selStates = useMemo(() => new Set(selection.states), [selection.states]);
  const selTrans = useMemo(() => new Set(selection.transitions), [selection.transitions]);
  const graph = useMemo(() => graphOf(doc.automaton), [doc.automaton]);

  const nodes = useMemo<StateNodeType[]>(
    () =>
      graph.states.map((s) => {
        const r = stateRadius(s.name);
        const position = drag[s.id] ?? doc.layout.positions[s.id] ?? { x: 0, y: 0 };
        return {
          id: s.id,
          type: 'state',
          position,
          data: { state: s, r },
          width: 2 * r,
          height: 2 * r,
          measured: { width: 2 * r, height: 2 * r },
          selected: selStates.has(s.id),
        };
      }),
    [graph.states, doc.layout.positions, drag, selStates],
  );

  const edges = useMemo<TransitionEdgeType[]>(() => {
    const circles = new Map(
      graph.states.map((s) => {
        const p = drag[s.id] ?? doc.layout.positions[s.id] ?? { x: 0, y: 0 };
        return [s.id, { x: p.x, y: p.y, r: stateRadius(s.name) }];
      }),
    );
    const labels = edgeLabels(doc.automaton);
    const items = labelItems(doc.automaton, doc.layout, circles, labels);
    const ts = resolveLabelTs(items);
    const byId = new Map(graph.transitions.map((t) => [t.id, t]));
    return items.map((it): TransitionEdgeType => {
      const t = byId.get(it.id)!;
      return {
        id: t.id,
        type: 'transition',
        source: t.from,
        target: t.to,
        sourceHandle: 'out',
        targetHandle: 'in',
        selected: selTrans.has(t.id),
        data: {
          from: it.from,
          to: it.to,
          label: labels.get(t.id)!,
          storedCurvature: doc.layout.edges[t.id]?.curvature ?? 0,
          curvature: it.curvature,
          loopAngle: it.loopAngle,
          labelT: ts[t.id] ?? 0.5,
        },
      };
    });
  }, [doc.automaton, graph, doc.layout, drag, selTrans]);

  /* ---------- React Flow → modelo ---------- */
  const onNodesChange = useCallback((changes: NodeChange<StateNodeType>[]) => {
    let preview: Record<string, Point> | null = null;
    let commit: Record<string, Point> | null = null;
    let sel: Set<string> | null = null;
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        if (c.dragging) (preview ??= {})[c.id] = c.position;
        else (commit ??= {})[c.id] = c.position;
      } else if (c.type === 'select') {
        sel ??= new Set(useEditorUi.getState().selection.states);
        if (c.selected) sel.add(c.id);
        else sel.delete(c.id);
      }
    }
    if (commit) {
      const done = commit;
      useDocuments.getState().moveStates(done);
      setDrag((d) => {
        const next = { ...d };
        for (const id of Object.keys(done)) delete next[id];
        return next;
      });
    }
    if (preview) {
      const p = preview;
      setDrag((d) => ({ ...d, ...p }));
    }
    if (sel) useEditorUi.getState().select({ states: [...sel] });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<TransitionEdgeType>[]) => {
    let sel: Set<string> | null = null;
    for (const c of changes) {
      if (c.type === 'select') {
        sel ??= new Set(useEditorUi.getState().selection.transitions);
        if (c.selected) sel.add(c.id);
        else sel.delete(c.id);
      }
    }
    if (sel) useEditorUi.getState().select({ transitions: [...sel] });
  }, []);

  const addStateAt = useCallback(
    (clientX: number, clientY: number) => {
      const p = snapPoint(rf.screenToFlowPosition({ x: clientX, y: clientY }), useEditorUi.getState().snap);
      const id = useDocuments.getState().addState(p);
      useEditorUi.getState().select({ states: [id], transitions: [] });
    },
    [rf],
  );

  const onPaneClick = useCallback(
    (e: ReactMouseEvent) => {
      const ui = useEditorUi.getState();
      ui.closeMenu();
      if (ui.tool === 'state') addStateAt(e.clientX, e.clientY);
    },
    [addStateAt],
  );

  const onDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as Element).classList?.contains('react-flow__pane')) addStateAt(e.clientX, e.clientY);
    },
    [addStateAt],
  );

  const onConnect = useCallback((c: Connection) => {
    pendingConnection.current = c;
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>((event) => {
    const c = pendingConnection.current;
    pendingConnection.current = null;
    if (!c) return;
    const p = 'changedTouches' in event ? event.changedTouches[0]! : event;
    useEditorUi.getState().openDialog({ kind: 'transition', from: c.source, to: c.target, x: p.clientX, y: p.clientY });
  }, []);

  /* ---------- atalhos ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const ui = useEditorUi.getState();
      // com janela ou menu suspenso aberto (Arquivo, Algoritmos...) as teclas não mexem no autômato
      if (ui.dialog || document.querySelector('[role="menu"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (key === 'a') {
          e.preventDefault();
          selectAll();
        }
        return;
      }
      if (e.altKey) return;
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        void fitAll(rf, container.current, 260);
        return;
      }
      switch (key) {
        case 'delete':
        case 'backspace':
          e.preventDefault();
          deleteSelection();
          break;
        case 'i':
          setInitialOnSelection();
          break;
        case 'f':
          toggleFinalOnSelection();
          break;
        case 's':
          ui.setTool(ui.tool === 'state' ? 'select' : 'state');
          break;
        case 'v':
          ui.setTool('select');
          break;
        case 'escape':
          ui.closeMenu();
          ui.setTool('select');
          ui.clearSelection();
          break;
        case 'f2': {
          const id = currentSelection().states[0];
          const p = id && useDocuments.getState().docs.find((d) => d.id === useDocuments.getState().activeId)?.layout.positions[id];
          if (id && p) {
            e.preventDefault();
            const s = rf.flowToScreenPosition(p);
            ui.openDialog({ kind: 'rename-state', stateId: id, x: s.x, y: s.y + 20 });
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rf]);

  /* ---------- aviso ao sair com algo não salvo ---------- */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useDocuments.getState().docs.some((d) => d.dirty && !isEmptyDoc(d))) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /* ---------- enquadramento por aba ---------- */
  const viewports = useRef(new Map<string, Viewport>());
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const prev = shownId.current;
    if (prev === doc.id) return;
    if (prev) viewports.current.set(prev, rf.getViewport());
    shownId.current = doc.id;
    useEditorUi.getState().clearSelection();
    const saved = viewports.current.get(doc.id);
    if (saved) {
      void rf.setViewport(saved);
      return;
    }
    // Numa aba nova (ex.: resultado de algoritmo) os estados ainda não foram
    // medidos no 1º quadro, e aí o fitView não faz nada. Espera a medição
    // (até ~1 s) antes de enquadrar.
    let raf = 0;
    let frames = 0;
    const tick = () => {
      const nodes = rf.getNodes();
      if (nodes.length === 0) {
        const el = container.current;
        void rf.setViewport({ x: (el?.clientWidth ?? 800) / 2, y: (el?.clientHeight ?? 600) / 2, zoom: 1 });
        return;
      }
      const measured = nodes.every((n) => n.measured?.width && n.measured?.height);
      if (!measured && frames++ < 60) {
        raf = requestAnimationFrame(tick);
        return;
      }
      void fitAll(rf, container.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [doc.id, rf, ready]);

  const empty = graph.states.length === 0;

  return (
    <div ref={container} className={tool === 'state' ? 'ed-canvas tool-state' : 'ed-canvas'}>
      <ReactFlow<StateNodeType, TransitionEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        connectionLineComponent={ConnectionLine}
        connectionDragThreshold={4}
        connectionRadius={26}
        connectOnClick={false}
        onPaneClick={onPaneClick}
        onDoubleClick={onDoubleClick}
        onNodeDoubleClick={(e, n) => {
          e.stopPropagation();
          useEditorUi.getState().openDialog({ kind: 'rename-state', stateId: n.id, x: e.clientX, y: e.clientY });
        }}
        onEdgeDoubleClick={(e, edge) => {
          useEditorUi.getState().openDialog({
            kind: 'transition',
            from: edge.source,
            to: edge.target,
            transitionId: edge.id,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          const ui = useEditorUi.getState();
          if (!ui.selection.states.includes(n.id)) ui.select({ states: [n.id], transitions: [] });
          ui.openMenu({ kind: 'state', id: n.id, x: e.clientX, y: e.clientY });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          const ui = useEditorUi.getState();
          if (!ui.selection.transitions.includes(edge.id)) ui.select({ states: [], transitions: [edge.id] });
          ui.openMenu({ kind: 'transition', id: edge.id, x: e.clientX, y: e.clientY });
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          useEditorUi.getState().openMenu({
            kind: 'pane',
            x: e.clientX,
            y: e.clientY,
            flow: snapPoint(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), useEditorUi.getState().snap),
          });
        }}
        onInit={() => setReady(true)}
        ariaLabelConfig={ARIA_PT_BR}
        onMoveStart={() => useEditorUi.getState().closeMenu()}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
        zoomOnDoubleClick={false}
        snapToGrid={snap}
        snapGrid={[GRID, GRID]}
        minZoom={0.2}
        maxZoom={3}
        colorMode={theme}
        attributionPosition="bottom-center"
        panOnDrag={[0, 1]}
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.6} color="var(--grid)" />
        {!empty && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeComponent={MiniNode}
            ariaLabel="Minimapa"
            style={{ width: 168, height: 112 }}
          />
        )}
        <Ghost container={container} />
      </ReactFlow>
      <Toolbar />
      <PropertiesChip />
      <ZoomControls />
      {empty && <EmptyHint kind={doc.automaton.kind} />}
    </div>
  );
}
