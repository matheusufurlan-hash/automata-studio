/**
 * Estado da interface das ferramentas (só da tela):
 *  - de onde veio o autômato de cada aba (resultado de qual algoritmo);
 *  - painel lateral recolhido/largura, seções abertas;
 *  - em que rodada/linha está cada tabela passo a passo;
 *  - janelas e menu do Algoritmos.
 */
import { create } from 'zustand';
import type { AutomatonKind } from '../../core/automaton';
import { useDocuments } from '../../store/documents';
import type { BinaryAlgo, Provenance } from './algorithms';

export type ToolsDialog =
  /** `section`: abre na seção AF, AP ou MT (padrão: o tipo da aba ativa). */
  | { kind: 'examples'; section?: AutomatonKind }
  | { kind: 'pick'; algo: BinaryAlgo | 'equivalence'; /** já compara ao abrir (prints) */ auto?: boolean };

export type SectionId = 'origin' | 'steps' | 'formal' | 'table' | 'delta';

export const SIDE_MIN = 300;
export const SIDE_MAX = 720;
export const SIDE_DEFAULT = 380;

interface ToolsState {
  provenance: Record<string, Provenance>;
  /** De qual exemplo da galeria veio a aba (AP/MT: o lote usa as palavras de teste dele). */
  exampleOf: Record<string, string>;
  /** Posição do passo a passo por documento (rodada da minimização / linha dos subconjuntos). */
  stepper: Record<string, number>;
  sideCollapsed: boolean;
  sideWidth: number;
  closedSections: Partial<Record<SectionId, boolean>>;
  dialog: ToolsDialog | null;
  /** Pedido para abrir o menu Algoritmos (usado pelos parâmetros de URL). */
  menuRequest: number;

  setProvenance(docId: string, p: Provenance): void;
  setExampleOf(docId: string, exampleId: string): void;
  setStepper(docId: string, pos: number): void;
  setSideCollapsed(c: boolean): void;
  setSideWidth(w: number): void;
  toggleSection(id: SectionId): void;
  openDialog(d: ToolsDialog): void;
  closeDialog(): void;
  requestMenu(): void;
}

const STORAGE_KEY = 'automatos-studio:painel-lateral';

function loadPrefs(): { sideCollapsed: boolean; sideWidth: number } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as { sideCollapsed?: unknown; sideWidth?: unknown };
      const w = typeof p.sideWidth === 'number' ? p.sideWidth : SIDE_DEFAULT;
      return { sideCollapsed: p.sideCollapsed === true, sideWidth: Math.max(SIDE_MIN, Math.min(SIDE_MAX, w)) };
    }
  } catch {
    /* sem localStorage */
  }
  return { sideCollapsed: false, sideWidth: SIDE_DEFAULT };
}

function savePrefs(p: { sideCollapsed: boolean; sideWidth: number }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* sem localStorage */
  }
}

const prefs = loadPrefs();

export const useTools = create<ToolsState>()((set, get) => ({
  provenance: {},
  exampleOf: {},
  stepper: {},
  sideCollapsed: prefs.sideCollapsed,
  sideWidth: prefs.sideWidth,
  closedSections: {},
  dialog: null,
  menuRequest: 0,

  setProvenance: (docId, p) => set((s) => ({ provenance: { ...s.provenance, [docId]: p } })),
  setExampleOf: (docId, exampleId) => set((s) => ({ exampleOf: { ...s.exampleOf, [docId]: exampleId } })),
  setStepper: (docId, pos) => set((s) => ({ stepper: { ...s.stepper, [docId]: pos } })),
  setSideCollapsed(sideCollapsed) {
    set({ sideCollapsed });
    savePrefs({ sideCollapsed, sideWidth: get().sideWidth });
  },
  setSideWidth(w) {
    const sideWidth = Math.round(Math.max(SIDE_MIN, Math.min(SIDE_MAX, w)));
    set({ sideWidth });
    savePrefs({ sideCollapsed: get().sideCollapsed, sideWidth });
  },
  toggleSection: (id) => set((s) => ({ closedSections: { ...s.closedSections, [id]: !s.closedSections[id] } })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  requestMenu: () => set((s) => ({ menuRequest: s.menuRequest + 1 })),
}));

/* Aba fechada: esquece de onde ela veio. */
useDocuments.subscribe((st) => {
  const tools = useTools.getState();
  const open = new Set(st.docs.map((d) => d.id));
  const stale = [...Object.keys(tools.provenance), ...Object.keys(tools.exampleOf)].filter((id) => !open.has(id));
  if (stale.length === 0) return;
  const provenance = { ...tools.provenance };
  const stepper = { ...tools.stepper };
  const exampleOf = { ...tools.exampleOf };
  for (const id of stale) {
    delete provenance[id];
    delete stepper[id];
    delete exampleOf[id];
  }
  useTools.setState({ provenance, stepper, exampleOf });
});
