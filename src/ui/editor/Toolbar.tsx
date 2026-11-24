/** Barra flutuante do canvas (ferramentas) e controles de zoom. */
import { useReactFlow, useStore } from '@xyflow/react';
import {
  CirclePlus,
  Keyboard,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Network,
  Plus,
  Redo2,
  Trash,
  Undo2,
} from 'lucide-react';
import { getActiveDoc, isEmptyDoc, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { deleteSelection, organize, redo, undo } from './actions';
import { canvasSize, contentViewport } from './fitContent';

export function Toolbar() {
  const tool = useEditorUi((s) => s.tool);
  const setTool = useEditorUi((s) => s.setTool);
  const snap = useEditorUi((s) => s.snap);
  const toggleSnap = useEditorUi((s) => s.toggleSnap);
  const hasSelection = useEditorUi((s) => s.selection.states.length + s.selection.transitions.length > 0);
  const canUndo = useDocuments((s) => (s.meta[s.activeId]?.past.length ?? 0) > 0);
  const canRedo = useDocuments((s) => (s.meta[s.activeId]?.future.length ?? 0) > 0);
  const empty = useDocuments((s) => isEmptyDoc(s.docs.find((d) => d.id === s.activeId) ?? s.docs[0]!));
  const openDialog = useEditorUi((s) => s.openDialog);

  return (
    <div className="ed-float" style={{ top: 14, left: 14 }} role="toolbar" aria-label="Ferramentas">
      <button
        type="button"
        className={tool === 'select' ? 'ed-icon-btn is-on' : 'ed-icon-btn'}
        onClick={() => setTool('select')}
        data-tip="Selecionar e mover (V)"
        aria-label="Selecionar"
      >
        <MousePointer2 size={17} />
      </button>
      <button
        type="button"
        className={tool === 'state' ? 'ed-icon-btn is-on' : 'ed-icon-btn'}
        onClick={() => setTool(tool === 'state' ? 'select' : 'state')}
        data-tip="Novo estado: clique no canvas (S)"
        aria-label="Ferramenta Estado"
      >
        <CirclePlus size={17} />
      </button>
      <span className="ed-sep" />
      <button type="button" className="ed-icon-btn" onClick={undo} disabled={!canUndo} data-tip="Desfazer (Ctrl+Z)" aria-label="Desfazer">
        <Undo2 size={17} />
      </button>
      <button type="button" className="ed-icon-btn" onClick={redo} disabled={!canRedo} data-tip="Refazer (Ctrl+Y)" aria-label="Refazer">
        <Redo2 size={17} />
      </button>
      <span className="ed-sep" />
      <button
        type="button"
        className="ed-icon-btn"
        onClick={deleteSelection}
        disabled={!hasSelection}
        data-tip="Apagar seleção (Delete)"
        aria-label="Apagar seleção"
      >
        <Trash size={17} />
      </button>
      <button type="button" className="ed-icon-btn" onClick={organize} disabled={empty} data-tip="Organizar automaticamente" aria-label="Organizar">
        <Network size={17} />
      </button>
      <button
        type="button"
        className={snap ? 'ed-icon-btn is-on' : 'ed-icon-btn'}
        onClick={toggleSnap}
        data-tip={snap ? 'Grade magnética: ligada' : 'Grade magnética: desligada'}
        aria-label="Grade magnética"
        aria-pressed={snap}
      >
        <Magnet size={17} />
      </button>
      <span className="ed-sep" />
      <button
        type="button"
        className="ed-icon-btn"
        onClick={() => openDialog({ kind: 'shortcuts' })}
        data-tip="Atalhos do teclado"
        aria-label="Atalhos"
      >
        <Keyboard size={17} />
      </button>
    </div>
  );
}

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView, zoomTo, setViewport } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  // AP/MT: enquadra contando os rótulos de várias linhas
  const fit = () => {
    const doc = getActiveDoc();
    const { width, height } = canvasSize();
    const vp = doc.automaton.kind === 'fa' ? null : contentViewport(doc.automaton, doc.layout, width, height);
    if (vp) void setViewport(vp, { duration: 260 });
    else void fitView({ padding: 0.2, maxZoom: 1.3, duration: 260 });
  };
  return (
    <div className="ed-float" style={{ bottom: 14, left: 14 }} role="group" aria-label="Zoom">
      <button type="button" className="ed-icon-btn sm" onClick={() => zoomOut({ duration: 160 })} data-tip="Diminuir" data-tip-pos="top" aria-label="Diminuir zoom">
        <Minus size={16} />
      </button>
      <button type="button" className="ed-zoom-label" onClick={() => zoomTo(1, { duration: 200 })} data-tip="Voltar a 100%" data-tip-pos="top">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="ed-icon-btn sm" onClick={() => zoomIn({ duration: 160 })} data-tip="Aumentar" data-tip-pos="top" aria-label="Aumentar zoom">
        <Plus size={16} />
      </button>
      <span className="ed-sep" />
      <button
        type="button"
        className="ed-icon-btn sm"
        onClick={fit}
        data-tip="Ajustar à tela (Shift+1)"
        data-tip-pos="top"
        aria-label="Ajustar à tela"
      >
        <Maximize size={15} />
      </button>
    </div>
  );
}
