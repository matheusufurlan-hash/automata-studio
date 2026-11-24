/**
 * Destaque mostrado no canvas (FORA do histórico de desfazer).
 *
 * A simulação aciona:
 *  - `active`: estados ativos (brilham na cor --active);
 *  - `viaEpsilon`: os que só entraram pelo fecho-ε (contorno tracejado);
 *  - `transitions`: transições usadas no passo (animadas);
 *  - `status`: 'accepted' / 'rejected' pintam os estados ativos de --accept / --reject;
 *  - `rules` (AP/MT, opcional): regras usadas no passo — a linha de cada uma
 *    fica destacada no rótulo da seta (RuleRef: transição + índice em `rules`).
 *
 * O destaque é limpo sozinho quando a aba ativa muda (ver documents.ts).
 */
import { create } from 'zustand';
import type { RuleRef } from '../core/common';
import type { StateId, TransitionId } from '../core/fa/types';

export type HighlightStatus = 'idle' | 'running' | 'accepted' | 'rejected';

export interface HighlightData {
  active: StateId[];
  viaEpsilon: StateId[];
  transitions: TransitionId[];
  /** AP/MT: regras usadas no passo (a linha delas no rótulo fica destacada). */
  rules?: RuleRef[];
  status: HighlightStatus;
}

export interface HighlightState extends HighlightData {
  set(h: Partial<HighlightData>): void;
  clear(): void;
}

const EMPTY: HighlightData = { active: [], viaEpsilon: [], transitions: [], rules: [], status: 'idle' };

export const useHighlight = create<HighlightState>()((set) => ({
  ...EMPTY,
  set: (h) => set(h),
  clear: () => set(EMPTY),
}));
