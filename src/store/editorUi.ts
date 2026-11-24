/**
 * Estado da interface do editor (não vai para o arquivo nem para o histórico):
 * ferramenta, seleção, grade magnética, menus, janelas e avisos.
 */
import { create } from 'zustand';
import type { Point, StateId, TransitionId } from '../core/fa/types';

export type Tool = 'select' | 'state';

/**
 * Coordenadas `x`/`y` de menus e janelas são da tela (clientX/clientY).
 * 'transition': editar a seta from→to — símbolos no AF, regras no AP e na MT.
 */
export type DialogState =
  | {
      kind: 'transition';
      from: StateId;
      to: StateId;
      transitionId?: TransitionId;
      x: number;
      y: number;
      /** AP/MT: abrir já no modo Texto (várias regras de uma vez). */
      mode?: 'list' | 'text';
    }
  | { kind: 'rename-state'; stateId: StateId; x: number; y: number }
  /** Propriedades do AP (Z0, aceitação) ou da MT (branco, aceitação, Σ). */
  | { kind: 'properties' }
  | { kind: 'save-as'; docId: string; closeAfter?: boolean }
  | { kind: 'confirm-close'; docId: string }
  | { kind: 'shortcuts' };

export type MenuState =
  | { kind: 'state'; id: StateId; x: number; y: number }
  | { kind: 'transition'; id: TransitionId; x: number; y: number }
  | { kind: 'pane'; x: number; y: number; flow: Point };

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

export interface Selection {
  states: StateId[];
  transitions: TransitionId[];
}

interface EditorUiState {
  tool: Tool;
  snap: boolean;
  selection: Selection;
  dialog: DialogState | null;
  menu: MenuState | null;
  toasts: Toast[];
  setTool(tool: Tool): void;
  toggleSnap(): void;
  select(sel: Partial<Selection>): void;
  clearSelection(): void;
  openDialog(d: DialogState): void;
  closeDialog(): void;
  openMenu(m: MenuState): void;
  closeMenu(): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
}

let toastCounter = 0;
const EMPTY_SELECTION: Selection = { states: [], transitions: [] };

export const useEditorUi = create<EditorUiState>()((set, get) => ({
  tool: 'select',
  snap: false,
  selection: EMPTY_SELECTION,
  dialog: null,
  menu: null,
  toasts: [],
  setTool: (tool) => set({ tool }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  select: (sel) => set((s) => ({ selection: { ...s.selection, ...sel } })),
  clearSelection: () => {
    const s = get().selection;
    if (s.states.length || s.transitions.length) set({ selection: EMPTY_SELECTION });
  },
  openDialog: (dialog) => set({ dialog, menu: null }),
  closeDialog: () => set({ dialog: null }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  toast: (text, kind = 'info') => {
    const id = ++toastCounter;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
