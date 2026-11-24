/** Comandos do editor usados por atalhos, menus e barra de ferramentas. */
import { graphOf } from '../../core/automaton';
import { autoLayout } from '../../layout/autoLayout';
import { getActiveDoc, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';

const docs = () => useDocuments.getState();
const ui = () => useEditorUi.getState();

/** Seleção sem ids que já não existem (ex.: depois de desfazer). */
export function currentSelection() {
  const g = graphOf(getActiveDoc().automaton);
  const sel = ui().selection;
  const states = new Set(g.states.map((s) => s.id));
  const trans = new Set(g.transitions.map((t) => t.id));
  return {
    states: sel.states.filter((id) => states.has(id)),
    transitions: sel.transitions.filter((id) => trans.has(id)),
  };
}

export function deleteSelection() {
  const sel = currentSelection();
  if (sel.states.length === 0 && sel.transitions.length === 0) return;
  docs().removeElements(sel.states, sel.transitions);
  ui().clearSelection();
}

export function selectAll() {
  const g = graphOf(getActiveDoc().automaton);
  ui().select({ states: g.states.map((s) => s.id), transitions: g.transitions.map((t) => t.id) });
}

export function setInitialOnSelection() {
  const id = currentSelection().states[0];
  if (id) docs().setInitial(id);
}

export function toggleFinalOnSelection() {
  for (const id of currentSelection().states) docs().toggleFinal(id);
}

export function organize() {
  const g = graphOf(getActiveDoc().automaton);
  if (g.states.length === 0) return;
  docs().applyLayout(autoLayout(g));
}

export function straighten(transitionId: string) {
  const t = graphOf(getActiveDoc().automaton).transitions.find((x) => x.id === transitionId);
  if (!t) return;
  if (t.from === t.to) docs().setEdgeLayout(t.id, { curvature: 0, loopAngle: 0 });
  else docs().setEdgeLayout(t.id, { curvature: 0 });
}

export function undo() {
  docs().undo();
}

export function redo() {
  docs().redo();
}
