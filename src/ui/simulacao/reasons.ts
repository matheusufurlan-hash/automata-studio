/** Textos do resultado da simulação (por que aceitou / por que rejeitou), em português claro. */
import type { FA, RejectReason, SimulationResult } from '../../core/fa/types';
import { alphabet } from '../../core/fa';
import { formatSet, formatStates, namesOf } from '../ferramentas/format';

export const REASON_TITLE: Record<RejectReason, string> = {
  NO_INITIAL_STATE: 'Sem estado inicial',
  SYMBOL_NOT_IN_ALPHABET: 'Símbolo fora do alfabeto',
  DEAD_END: 'A simulação morreu',
  ENDED_IN_NON_FINAL: 'Terminou fora de um estado final',
};

/**
 * Uma frase curta que explica o resultado.
 *  - DEAD_END: "nenhuma transição com 'b' a partir de {q1}";
 *  - ENDED_IN_NON_FINAL: "terminou em {q2}, que não é final";
 *  - SYMBOL_NOT_IN_ALPHABET: "o símbolo 'c' não está em Σ = {0, 1}";
 *  - NO_INITIAL_STATE: "o autômato não tem estado inicial".
 */
export function verdictText(fa: FA, word: string, result: SimulationResult): string {
  const chars = Array.from(word);
  const steps = result.steps;
  const last = steps[steps.length - 1];
  if (result.accepted) {
    if (!last) return 'aceita';
    const finals = new Set(fa.states.filter((s) => s.final).map((s) => s.id));
    const set = formatStates(fa, last.active);
    if (last.active.length === 1) return `terminou em ${set}, que é final`;
    const hit = namesOf(fa, last.active.filter((id) => finals.has(id)));
    return hit.length === 1
      ? `terminou em ${set}, que contém o estado final ${hit[0]}`
      : `terminou em ${set}, que contém os estados finais ${hit.join(', ')}`;
  }
  switch (result.reason) {
    case 'NO_INITIAL_STATE':
      return 'o autômato não tem estado inicial: marque um estado como inicial para simular';
    case 'SYMBOL_NOT_IN_ALPHABET': {
      const pos = result.stoppedAt ?? 0;
      const sym = chars[pos] ?? '?';
      const sigma = alphabet(fa);
      return `o símbolo '${sym}' (posição ${pos + 1}) não está em Σ = ${formatSet(sigma, ', ')}`;
    }
    case 'DEAD_END': {
      const pos = result.stoppedAt ?? Math.max(0, steps.length - 2);
      const sym = chars[pos] ?? '?';
      const before = steps[steps.length - 2];
      const from = before ? formatStates(fa, before.active) : '∅';
      return `nenhuma transição com '${sym}' a partir de ${from}`;
    }
    case 'ENDED_IN_NON_FINAL':
    default: {
      const active = last?.active ?? [];
      const set = formatStates(fa, active);
      return active.length <= 1 ? `terminou em ${set}, que não é final` : `terminou em ${set}, e nenhum deles é final`;
    }
  }
}
