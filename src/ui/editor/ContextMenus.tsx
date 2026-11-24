/** Menus do clique direito: estado, transição e fundo do canvas. */
import { useCallback } from 'react';
import { CirclePlus, Flag, Network, Pencil, Settings2, Spline, SquareMousePointer, Trash, Type } from 'lucide-react';
import { graphOf } from '../../core/automaton';
import { useActiveDoc, useDocuments } from '../../store/documents';
import type { MenuState } from '../../store/editorUi';
import { useEditorUi } from '../../store/editorUi';
import { currentSelection, deleteSelection, organize, selectAll, straighten } from './actions';
import { MenuItem, MenuSeparator, MenuSurface } from './Menu';
import { openProperties } from './Properties';

function StateMenu({ m }: { m: Extract<MenuState, { kind: 'state' }> }) {
  const doc = useActiveDoc();
  const state = graphOf(doc.automaton).states.find((s) => s.id === m.id);
  const ui = useEditorUi.getState;
  const done = () => ui().closeMenu();
  if (!state) return null;
  const many = currentSelection().states.length > 1;
  return (
    <>
      <MenuItem
        icon={<ArrowIn />}
        label="Estado inicial"
        keys={['I']}
        checked={state.initial}
        onSelect={() => {
          useDocuments.getState().setInitial(state.id);
          done();
        }}
      />
      <MenuItem
        icon={<Flag size={16} />}
        label="Estado final"
        keys={['F']}
        checked={state.final}
        onSelect={() => {
          useDocuments.getState().toggleFinal(state.id);
          done();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={<Type size={16} />}
        label="Renomear…"
        keys={['F2']}
        onSelect={() => ui().openDialog({ kind: 'rename-state', stateId: state.id, x: m.x, y: m.y })}
      />
      <MenuItem
        icon={<Trash size={16} />}
        label={many ? 'Apagar seleção' : 'Apagar'}
        keys={['Delete']}
        danger
        onSelect={() => {
          if (many) deleteSelection();
          else useDocuments.getState().removeElements([state.id], []);
          done();
        }}
      />
    </>
  );
}

/** Ícone "seta entrando num círculo" (estado inicial). */
function ArrowIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10.5" cy="8" r="4.2" />
      <path d="M1 8h3.6" />
      <path d="M3.6 6.2 5.6 8l-2 1.8" strokeLinejoin="round" />
    </svg>
  );
}

function TransitionMenu({ m }: { m: Extract<MenuState, { kind: 'transition' }> }) {
  const doc = useActiveDoc();
  const t = graphOf(doc.automaton).transitions.find((x) => x.id === m.id);
  const ui = useEditorUi.getState;
  const done = () => ui().closeMenu();
  if (!t) return null;
  const isLoop = t.from === t.to;
  const e = doc.layout.edges[t.id];
  const bent = isLoop ? (e?.loopAngle ?? 0) !== 0 : (e?.curvature ?? 0) !== 0;
  return (
    <>
      <MenuItem
        icon={<Pencil size={16} />}
        label={doc.automaton.kind === 'fa' ? 'Editar símbolos…' : 'Editar regras…'}
        onSelect={() =>
          ui().openDialog({ kind: 'transition', from: t.from, to: t.to, transitionId: t.id, x: m.x, y: m.y })
        }
      />
      <MenuItem
        icon={<Spline size={16} />}
        label={isLoop ? 'Laço para cima' : 'Endireitar'}
        disabled={!bent}
        onSelect={() => {
          straighten(t.id);
          done();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={<Trash size={16} />}
        label="Apagar"
        keys={['Delete']}
        danger
        onSelect={() => {
          useDocuments.getState().removeElements([], [t.id]);
          done();
        }}
      />
    </>
  );
}

function PaneMenu({ m }: { m: Extract<MenuState, { kind: 'pane' }> }) {
  const ui = useEditorUi.getState;
  const done = () => ui().closeMenu();
  const automaton = useActiveDoc().automaton;
  const empty = graphOf(automaton).states.length === 0;
  return (
    <>
      <MenuItem
        icon={<CirclePlus size={16} />}
        label="Novo estado aqui"
        onSelect={() => {
          const id = useDocuments.getState().addState(m.flow);
          ui().select({ states: [id], transitions: [] });
          done();
        }}
      />
      <MenuItem
        icon={<SquareMousePointer size={16} />}
        label="Selecionar tudo"
        keys={['Ctrl', 'A']}
        disabled={empty}
        onSelect={() => {
          selectAll();
          done();
        }}
      />
      <MenuItem
        icon={<Network size={16} />}
        label="Organizar automaticamente"
        disabled={empty}
        onSelect={() => {
          organize();
          done();
        }}
      />
      {automaton.kind !== 'fa' && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={<Settings2 size={16} />}
            label={automaton.kind === 'pda' ? 'Propriedades do AP…' : 'Propriedades da MT…'}
            onSelect={openProperties}
          />
        </>
      )}
    </>
  );
}

export function ContextMenus() {
  const menu = useEditorUi((s) => s.menu);
  const closeMenu = useEditorUi((s) => s.closeMenu);
  const onClose = useCallback(() => closeMenu(), [closeMenu]);
  const doc = useActiveDoc();
  if (!menu) return null;
  const g = graphOf(doc.automaton);
  let title: string | undefined;
  if (menu.kind === 'state') title = `Estado ${g.states.find((s) => s.id === menu.id)?.name ?? ''}`;
  if (menu.kind === 'transition') {
    const t = g.transitions.find((x) => x.id === menu.id);
    const name = (id?: string) => g.states.find((s) => s.id === id)?.name ?? '?';
    title = t ? `Transição ${name(t.from)} → ${name(t.to)}` : undefined;
  }
  return (
    <MenuSurface key={`${menu.kind}-${menu.x}-${menu.y}`} x={menu.x} y={menu.y} title={title} onClose={onClose}>
      {menu.kind === 'state' && <StateMenu m={menu} />}
      {menu.kind === 'transition' && <TransitionMenu m={menu} />}
      {menu.kind === 'pane' && <PaneMenu m={menu} />}
    </MenuSurface>
  );
}
