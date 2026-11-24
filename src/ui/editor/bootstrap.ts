/**
 * Lê a URL uma vez, ao carregar:
 *  - `?demo=<id>` abre um exemplo de demos.ts;
 *  - `?novo=af|ap|mt` abre uma aba vazia desse tipo (no lugar da aba vazia inicial);
 *  - `&menu=novo` abre o menu Novo (feito em TabBar.tsx) — só para print;
 *  - `&highlight=q0,q2` liga o destaque nesses estados (nomes ou ids) — só para print;
 *  - `&via=q1` (contorno de fecho-ε), `&edges=q0>q1,q1>q1` (transições), `&status=accepted|rejected|running`;
 *  - `&regras=q0>q0:2` (AP/MT) destaca a regra nº 2 (0 = 1ª) da seta q0→q0 no rótulo — só para print;
 *  - `&editar=q0>q1` abre a janela da transição (`&modo=texto`: regras no modo Texto) — só para print;
 *  - `&propriedades=1` abre as propriedades do AP/MT — só para print.
 */
import { graphOf } from '../../core/automaton';
import type { AnyAutomatonFile, AutomatonKind } from '../../core/automaton';
import type { GraphLike } from '../../core/common';
import { getActiveDoc, UNTITLED, useDocuments } from '../../store/documents';
import type { HighlightStatus } from '../../store/highlight';
import { useEditorUi } from '../../store/editorUi';
import { useHighlight } from '../../store/highlight';
import { DEMOS } from './demos';

let done = false;

const NEW_KIND: Record<string, AutomatonKind> = { af: 'fa', ap: 'pda', mt: 'tm' };

function resolveStates(fa: GraphLike, list: string | null): string[] {
  if (!list) return [];
  return list
    .split(',')
    .map((x) => x.trim())
    .map((x) => fa.states.find((s) => s.id === x || s.name === x)?.id)
    .filter((x): x is string => !!x);
}

export function bootstrapFromUrl() {
  if (done || typeof window === 'undefined') return;
  done = true;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const demo = params.get('demo');
  const demos: Record<string, AnyAutomatonFile | undefined> = DEMOS;
  const file = demo ? demos[demo] : undefined;
  if (file) useDocuments.getState().loadFile(structuredClone(file), { template: true });
  const novo = NEW_KIND[params.get('novo') ?? ''];
  if (novo && !file) {
    const st = useDocuments.getState();
    const pristine = st.activeId;
    st.newDoc(UNTITLED, novo);
    st.closeDoc(pristine);
  }

  const fa = graphOf(getActiveDoc().automaton);
  const active = resolveStates(fa, params.get('highlight'));
  const viaEpsilon = resolveStates(fa, params.get('via'));
  const transitions = (params.get('edges') ?? '')
    .split(',')
    .map((pair) => {
      const [a, b] = pair.split('>').map((x) => x.trim());
      const [from] = resolveStates(fa, a ?? null);
      const [to] = resolveStates(fa, b ?? null);
      return fa.transitions.find((t) => t.id === pair.trim() || (t.from === from && t.to === to))?.id;
    })
    .filter((x): x is string => !!x);
  const rules = (params.get('regras') ?? '')
    .split(',')
    .map((item) => {
      const [edge, n] = item.split(':').map((x) => x.trim());
      const [a, b] = (edge ?? '').split('>');
      const [from] = resolveStates(fa, a ?? null);
      const [to] = resolveStates(fa, b ?? null);
      const t = fa.transitions.find((x) => x.id === edge || (x.from === from && x.to === to));
      return t && n !== undefined ? { transition: t.id, rule: Number(n) || 0 } : null;
    })
    .filter((x): x is { transition: string; rule: number } => !!x);
  if (active.length || viaEpsilon.length || transitions.length || rules.length) {
    const s = params.get('status');
    const status: HighlightStatus = s === 'accepted' || s === 'rejected' || s === 'idle' ? s : 'running';
    useHighlight.getState().set({ active: [...new Set([...active, ...viaEpsilon])], viaEpsilon, transitions, rules, status });
  }

  // janelas abertas para print (espera a tela assentar)
  const editar = params.get('editar');
  if (editar) {
    const [a, b] = editar.split('>').map((x) => x.trim());
    const [from] = resolveStates(fa, a ?? null);
    const [to] = resolveStates(fa, b ?? null);
    const mode = params.get('modo') === 'texto' ? 'text' : 'list';
    if (from && to) {
      setTimeout(
        () => useEditorUi.getState().openDialog({ kind: 'transition', from, to, x: window.innerWidth / 2 - 180, y: 120, mode }),
        300,
      );
    }
  }
  if (params.get('propriedades') === '1') {
    setTimeout(() => useEditorUi.getState().openDialog({ kind: 'properties' }), 300);
  }
}
