/**
 * CONTRATO — tipos compartilhados pelos núcleos (AF, AP e MT).
 *
 * Os tipos de ids e de desenho nasceram em `fa/types.ts` na rodada 1 e
 * continuam lá, para não mexer no que já funciona. Aqui eles são reexportados
 * para os núcleos novos (AP e MT) e para a interface.
 *
 * Este arquivo é contrato: o resto do app depende dele, então mude com cuidado.
 */
import type { StateId, TransitionId } from './fa/types';

export { EPSILON } from './fa/types';
export type { EdgeLayout, Layout, Point, StateId, Sym, TransitionId } from './fa/types';

/** Estado de qualquer autômato (mesmo formato do FAState). */
export interface AutomatonState {
  id: StateId;
  /** Nome mostrado na tela, ex.: "q0". */
  name: string;
  initial: boolean;
  final: boolean;
}

/** O mínimo que o desenho precisa saber de qualquer autômato (AF, AP ou MT). */
export interface GraphLike {
  states: readonly AutomatonState[];
  transitions: readonly { id: TransitionId; from: StateId; to: StateId }[];
}

/** Qual regra foi usada num passo: a transição e o índice em `transition.rules`. */
export interface RuleRef {
  transition: TransitionId;
  rule: number;
}

/** Situação de um nó da árvore de descrições instantâneas (IDs). */
export type IDStatus =
  /** A palavra é aceita nesta ID (não é expandida). */
  | 'ACCEPTING'
  /** Alguma regra se aplicou: a ID tem filhos. */
  | 'EXPANDED'
  /** Nenhuma regra se aplica e a ID não aceita (o ramo morre / a MT para rejeitando). */
  | 'DEAD'
  /** Esta mesma ID já apareceu antes na árvore: não é expandida de novo. */
  | 'REPEATED'
  /** A busca parou antes de expandir esta ID (porque já aceitou ou porque bateu no limite). */
  | 'UNEXPLORED';

/**
 * Nó da árvore de IDs, montada por BUSCA EM LARGURA. A árvore é um array:
 * a raiz é o índice 0. Os filhos de um nó vêm na ordem das transições no
 * autômato e, dentro de cada transição, na ordem de `rules`.
 */
export interface IDNode<C> {
  /** Índice deste nó no array da árvore. */
  index: number;
  parent: number | null;
  children: number[];
  config: C;
  /** Regra usada para chegar aqui (null na raiz). */
  via: RuleRef | null;
  /** 0 na raiz = número de movimentos desde o início. */
  depth: number;
  status: IDStatus;
}
