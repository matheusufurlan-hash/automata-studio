/**
 * Algoritmos do AP no menu (funções puras): as conversões entre os modos de
 * aceitação do Hopcroft (seção 6.2) — Teorema 6.9 (pilha vazia → estado
 * final) e Teorema 6.11 (estado final → pilha vazia) —, quando cada uma faz
 * sentido, o desenho do resultado e a explicação curta da construção.
 *
 * Desenho: os estados originais ficam onde estavam (com as mesmas setas); o
 * novo inicial p0 entra à esquerda do inicial antigo; o novo final pf (6.9)
 * fica embaixo do desenho, onde chegam setas de todos os estados; o estado p
 * que esvazia a pilha (6.11) fica à direita dos finais.
 */
import { toEmptyStack, toFinalState } from '../../core/pda';
import type { Layout, PDA, StateId } from '../../core/pda/types';
import { bestLoopAngle, curvatureAvoiding } from '../../layout/autoLayout';

export type PDAAlgo = 'toFinalState' | 'toEmptyStack';

export const PDA_ALGO_LABEL: Record<PDAAlgo, string> = {
  toFinalState: 'Pilha vazia → estado final',
  toEmptyStack: 'Estado final → pilha vazia',
};

export const PDA_ALGO_THEOREM: Record<PDAAlgo, string> = {
  toFinalState: 'Teorema 6.9',
  toEmptyStack: 'Teorema 6.11',
};

/** Por que a conversão NÃO pode rodar agora (null = pode). */
export function pdaUnavailableReason(id: PDAAlgo, pda: PDA): string | null {
  if (pda.states.length === 0) return 'o AP está vazio';
  if (!pda.states.some((s) => s.initial)) return 'sem estado inicial';
  if (id === 'toFinalState' && pda.acceptance === 'FINAL_STATE') return 'ele já aceita por estado final';
  if (id === 'toEmptyStack' && pda.acceptance === 'EMPTY_STACK') return 'ele já aceita por pilha vazia';
  return null;
}

export interface PDAAlgoOutput {
  name: string;
  pda: PDA;
  layout: Layout;
  title: string;
  notes: string[];
  /** Aviso curto depois de rodar. */
  message: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Desenho do resultado: os originais no mesmo lugar e os estados novos em volta. */
export function conversionLayout(source: PDA, sourceLayout: Layout, result: PDA, algo: PDAAlgo): Layout {
  const kept = new Set(source.states.filter((s) => Object.hasOwn(sourceLayout.positions, s.id)).map((s) => s.id));
  const positions: Layout['positions'] = {};
  for (const s of result.states) if (kept.has(s.id)) positions[s.id] = { ...sourceLayout.positions[s.id]! };
  const pts = Object.values(positions);
  const minX = pts.length ? Math.min(...pts.map((p) => p.x)) : 0;
  const maxX = pts.length ? Math.max(...pts.map((p) => p.x)) : 0;
  const minY = pts.length ? Math.min(...pts.map((p) => p.y)) : 0;
  const maxY = pts.length ? Math.max(...pts.map((p) => p.y)) : 0;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const free = (x: number, y: number) => pts.every((p) => Math.hypot(p.x - x, p.y - y) > 110);

  const fresh = result.states.filter((s) => !kept.has(s.id));
  const oldInitial = source.states.find((s) => s.initial && kept.has(s.id));
  for (const s of fresh) {
    if (s.initial) {
      // p0 à esquerda do inicial antigo (sobe se o lugar estiver ocupado)
      const base = oldInitial ? positions[oldInitial.id]! : { x: minX, y: midY };
      let pos = { x: base.x - 190, y: base.y };
      if (!free(pos.x, pos.y)) pos = { x: base.x - 150, y: base.y - 140 };
      positions[s.id] = pos;
    } else if (algo === 'toFinalState') {
      // pf embaixo do desenho: todos os estados têm seta para ele
      positions[s.id] = { x: Math.round(midX), y: maxY + 190 };
    } else {
      // p à direita dos finais (é deles que saem as setas para p)
      const finals = source.states.filter((f) => f.final && kept.has(f.id)).map((f) => positions[f.id]!);
      const fx = finals.length ? Math.max(...finals.map((p) => p.x)) : maxX;
      const fy = finals.length ? finals.reduce((acc, p) => acc + p.y, 0) / finals.length : midY;
      let pos = { x: fx + 200, y: Math.round(fy) };
      if (!free(pos.x, pos.y)) pos = { x: fx + 200, y: Math.round(fy) + 150 };
      positions[s.id] = pos;
    }
  }

  // setas: as originais mantêm a curva; as novas desviam dos estados
  const edges: Layout['edges'] = {};
  const layout: Layout = { positions, edges };
  for (const t of result.transitions) {
    const old = source.transitions.find((o) => o.id === t.id && o.from === t.from && o.to === t.to);
    const e = old && sourceLayout.edges[t.id];
    if (e) {
      edges[t.id] = { ...e };
      continue;
    }
    if (t.from === t.to) edges[t.id] = { curvature: 0, loopAngle: bestLoopAngle(result, layout, t.from) };
    else {
      const k = curvatureAvoiding(positions, t.from, t.to);
      if (k !== 0) edges[t.id] = { curvature: k };
    }
  }
  return layout;
}

export function runPDAAlgo(id: PDAAlgo, name: string, pda: PDA, layout: Layout): PDAAlgoOutput {
  const out = id === 'toFinalState' ? toFinalState(pda) : toEmptyStack(pda);
  const nameOf = (a: PDA, sid: StateId | undefined) => a.states.find((s) => s.id === sid)?.name ?? '?';
  const fresh = out.states.filter((s) => !pda.states.some((o) => o.id === s.id));
  const p0 = fresh.find((s) => s.initial)?.name ?? 'p0';
  const other = fresh.find((s) => !s.initial)?.name ?? (id === 'toFinalState' ? 'pf' : 'p');
  const x0 = out.startStackSymbol;
  const z0 = pda.startStackSymbol;
  const q0 = nameOf(pda, pda.states.find((s) => s.initial)?.id);
  const n = out.states.length;
  if (id === 'toFinalState') {
    return {
      name: `${name} (estado final)`,
      pda: out,
      layout: conversionLayout(pda, layout, out, id),
      title: `Pilha vazia → estado final (${PDA_ALGO_THEOREM[id]})`,
      notes: [
        `Novo estado inicial ${p0}: a regra ε, ${x0}/${z0}${x0} põe ${z0} em cima de um fundo novo ${x0} e vai para ${q0}.`,
        `${x0} só volta ao topo quando o AP original esvazia a pilha: de cada estado, ε, ${x0}/ε leva ao novo final ${other}.`,
        `Assim L(P_F) = N(P): por estado final, o AP novo aceita exatamente o que ${name} aceitava por pilha vazia.`,
      ],
      message: `AP por estado final com ${plural(n, 'estado', 'estados')} (${p0} e ${other} são novos).`,
    };
  }
  return {
    name: `${name} (pilha vazia)`,
    pda: out,
    layout: conversionLayout(pda, layout, out, id),
    title: `Estado final → pilha vazia (${PDA_ALGO_THEOREM[id]})`,
    notes: [
      `Novo estado inicial ${p0}: a regra ε, ${x0}/${z0}${x0} põe um fundo novo ${x0} embaixo de ${z0}, para a pilha do original não esvaziar por acaso.`,
      `De cada estado final, ε, Y/ε (para todo Y de Γ e ${x0}) leva a ${other}, que esvazia a pilha com o laço ε, Y/ε.`,
      `Assim N(P_N) = L(P): por pilha vazia, o AP novo aceita exatamente o que ${name} aceitava por estado final.`,
    ],
    message: `AP por pilha vazia com ${plural(n, 'estado', 'estados')} (${p0} e ${other} são novos).`,
  };
}
