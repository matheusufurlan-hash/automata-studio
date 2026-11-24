/** Comandos das ferramentas: rodar algoritmos, abrir exemplos, comparar. */
import { accepts, equivalent } from '../../core/fa';
import type { FA, Layout } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import { TM_EXAMPLES } from '../../core/tm/examples';
import { faOf, getActiveDoc, pdaOf, useDocuments } from '../../store/documents';
import type { PDAAlgo } from './pdaAlgorithms';
import { pdaUnavailableReason, runPDAAlgo } from './pdaAlgorithms';
import { useEditorUi } from '../../store/editorUi';
import { useSimulation } from '../simulacao/store';
import type { AlgoOutput, BinaryAlgo, UnaryAlgo } from './algorithms';
import { runBinary, runUnary, unavailableReason } from './algorithms';
import { useTools } from './store';

const toast = (text: string, kind: 'info' | 'success' | 'error' = 'info') => useEditorUi.getState().toast(text, kind);

/**
 * Quando o algoritmo MANTÉM os estados (completar, complemento de AFD, remover
 * inalcançáveis/inúteis), o resultado mantém o desenho do aluno: mesmos
 * estados nas mesmas posições, e o estado novo (ex.: o morto) entra à direita.
 * Se o resultado for outro autômato (AFN→AFD, mínimo...), devolve undefined e
 * a aba usa o layout automático.
 */
export function keepLayout(result: FA, source: { fa: FA; layout: Layout }): Layout | undefined {
  const same = (id: string, name: string) =>
    Object.hasOwn(source.layout.positions, id) && source.fa.states.some((s) => s.id === id && s.name === name);
  const kept = result.states.filter((s) => same(s.id, s.name));
  const added = result.states.filter((s) => !same(s.id, s.name));
  if (kept.length === 0 || added.length > 1) return undefined;

  const positions: Layout['positions'] = {};
  for (const s of kept) positions[s.id] = { ...source.layout.positions[s.id]! };
  const pts = Object.values(positions);
  const maxX = Math.max(...pts.map((p) => p.x));
  const midY = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
  added.forEach((s, i) => (positions[s.id] = { x: maxX + 200, y: midY + i * 140 }));

  const edges: Layout['edges'] = {};
  for (const t of result.transitions) {
    const old = source.fa.transitions.find((o) => o.id === t.id && o.from === t.from && o.to === t.to);
    const e = old && source.layout.edges[t.id];
    if (e) edges[t.id] = { ...e };
  }
  return { positions, edges };
}

/** Abre o resultado numa aba nova e lembra de onde ele veio. */
function openResult(out: AlgoOutput, source?: { fa: FA; layout: Layout }) {
  useDocuments.getState().openInNewTab(out.name, out.fa, source ? keepLayout(out.fa, source) : undefined);
  const id = useDocuments.getState().activeId;
  const tools = useTools.getState();
  tools.setProvenance(id, out.provenance);
  tools.setStepper(id, out.provenance.kind === 'minimize' ? -1 : 0);
  if (out.provenance.kind !== 'other' && tools.sideCollapsed) tools.setSideCollapsed(false);
  toast(out.message, 'success');
}

/** Aviso para os algoritmos de AF quando a aba ativa é AP ou MT. */
export const NOT_FA_YET = 'Este algoritmo é de autômato finito: abra uma aba de AF.';

/** Conversão do AP (Teoremas 6.9 e 6.11): abre o resultado numa aba nova, com a explicação no painel. */
export function runPDAAlgorithm(id: PDAAlgo) {
  const doc = getActiveDoc();
  const pda = pdaOf(doc);
  if (!pda) {
    toast('Este algoritmo é de autômato com pilha: abra uma aba de AP.');
    return;
  }
  const reason = pdaUnavailableReason(id, pda);
  if (reason) {
    toast(`Não dá para converter agora: ${reason}.`, 'error');
    return;
  }
  const out = runPDAAlgo(id, doc.name, pda, doc.layout);
  useDocuments.getState().openInNewTab(out.name, { kind: 'pda', pda: out.pda }, out.layout);
  const tools = useTools.getState();
  const newId = useDocuments.getState().activeId;
  tools.setProvenance(newId, { kind: 'pda', pda: out.pda, algo: id, title: out.title, notes: out.notes });
  if (tools.sideCollapsed) tools.setSideCollapsed(false);
  toast(out.message, 'success');
}

export function runUnaryAlgorithm(id: UnaryAlgo) {
  const doc = getActiveDoc();
  const fa = faOf(doc);
  if (!fa) {
    toast(NOT_FA_YET);
    return;
  }
  const reason = unavailableReason(id, fa);
  if (reason) {
    toast(`Não dá para rodar agora: ${reason}.`, 'error');
    return;
  }
  openResult(runUnary(id, doc.name, fa), { fa, layout: doc.layout });
}

/** Outras abas com autômato (para União, Interseção, Equivalência...). */
export function otherDocs() {
  const st = useDocuments.getState();
  return st.docs.filter((d) => {
    const fa = faOf(d);
    return d.id !== st.activeId && !!fa && fa.states.length > 0 && fa.states.some((s) => s.initial);
  });
}

export function runBinaryAlgorithm(id: BinaryAlgo, otherId: string) {
  const a = getActiveDoc();
  const b = useDocuments.getState().docs.find((d) => d.id === otherId);
  const fa = faOf(a);
  const fb = b ? faOf(b) : null;
  if (!b || !fa || !fb) return;
  openResult(runBinary(id, a.name, fa, b.name, fb));
}

export interface Comparison {
  equivalent: boolean;
  counterexample?: string;
  /** Quem aceita o contraexemplo: 'a' ou 'b'. */
  acceptedBy?: 'a' | 'b';
}

export function compare(a: FA, b: FA): Comparison {
  const r = equivalent(a, b);
  if (r.equivalent || r.counterexample === undefined) return { equivalent: r.equivalent };
  return { equivalent: false, counterexample: r.counterexample, acceptedBy: accepts(a, r.counterexample) ? 'a' : 'b' };
}

/** Abre um exemplo da galeria (AF, AP ou MT) numa aba nova (a aba vazia e intocada é reaproveitada). */
export function openExample(id: string) {
  const docs = useDocuments.getState();
  const fa = FA_EXAMPLES.find((x) => x.id === id);
  if (fa) {
    docs.loadFile({
      format: 'automatos-studio',
      version: 1,
      kind: 'fa',
      name: fa.name,
      fa: structuredClone(fa.fa),
      layout: structuredClone(fa.layout),
    }, { template: true });
    return;
  }
  const pda = PDA_EXAMPLES.find((x) => x.id === id);
  if (pda) {
    docs.loadFile(
      { format: 'automatos-studio', version: 1, kind: 'pda', name: pda.name, pda: structuredClone(pda.pda), layout: structuredClone(pda.layout) },
      { template: true },
    );
    useTools.getState().setExampleOf(useDocuments.getState().activeId, id);
    return;
  }
  const tm = TM_EXAMPLES.find((x) => x.id === id);
  if (tm) {
    docs.loadFile(
      { format: 'automatos-studio', version: 1, kind: 'tm', name: tm.name, tm: structuredClone(tm.tm), layout: structuredClone(tm.layout) },
      { template: true },
    );
    useTools.getState().setExampleOf(useDocuments.getState().activeId, id);
  }
}

/** Palavras de teste do exemplo de onde a aba veio (AP/MT da galeria), ou null. */
export function examplesSamples(docId: string): Array<{ word: string; accepted: boolean; output?: string }> | null {
  const id = useTools.getState().exampleOf[docId];
  if (!id) return null;
  return PDA_EXAMPLES.find((x) => x.id === id)?.samples ?? TM_EXAMPLES.find((x) => x.id === id)?.samples ?? null;
}

/** Põe a palavra no simulador (aba Simulação) e vai ao passo 0. */
export function simulateWord(word: string) {
  const sim = useSimulation.getState();
  sim.setTab('simulate');
  sim.load(word);
}
