/**
 * API pública do núcleo de Autômatos com Pilha (AP) — modelo do Hopcroft (cap. 6).
 *
 * As ASSINATURAS fazem parte do contrato (mudar com cuidado).
 * Os CORPOS podem ser divididos em outros arquivos dentro de src/core/pda/.
 *
 * Convenções:
 *  - funções puras: recebem um PDA e devolvem dados NOVOS, sem modificar a entrada;
 *  - regras inválidas (ver validate) e transições penduradas são ignoradas por
 *    todos os algoritmos;
 *  - mais de um estado inicial (arquivo inválido): a simulação usa o PRIMEIRO
 *    (na ordem de `states`); validate avisa;
 *  - nomes em ordem natural: q2 vem antes de q10;
 *  - simulação = busca em largura na árvore de IDs, sem expandir de novo uma ID
 *    que já apareceu (REPEATED). Filhos na ordem das transições em
 *    `pda.transitions` e, dentro de cada uma, na ordem de `rules`. Uma ID que
 *    aceita não é expandida. Assim o caminho de aceitação é o MAIS CURTO;
 *  - autômatos gerados (conversões): mantêm os ids e nomes originais; estados
 *    novos ganham o primeiro id "qN" livre e os nomes do Hopcroft ("p0", "pf",
 *    "p"; com apóstrofo se o nome já existir); transições novas ganham o
 *    primeiro id "tN" livre; o novo fundo de pilha X0 é o primeiro destes que
 *    não estiver em Γ: 'X', '$', '#', '⊥', '@'.
 *  - Os exemplos (convertidos do YAAS) ficam em ./examples (PDA_EXAMPLES).
 */
import type {
  PDA,
  PDAConfig,
  PDAFormalDefinition,
  PDASimulateOptions,
  PDASimulationResult,
  PDAType,
  PDAValidationIssue,
  Sym,
} from './types';
import * as basics from './basics';
import * as conv from './convert';
import * as sim from './simulate';

export * from './types';

/** Σ: todos os símbolos lidos pelas regras, sem ε, em ordem alfabética. */
export function inputAlphabet(pda: PDA): Sym[] {
  return basics.inputAlphabet(pda);
}

/** Γ: Z0 + todos os símbolos de `pop` e de `push`, em ordem alfabética. */
export function stackAlphabet(pda: PDA): Sym[] {
  return basics.stackAlphabet(pda);
}

/** Problemas do AP (sem inicial, regra inválida, Z0 inválido...). */
export function validate(pda: PDA): PDAValidationIssue[] {
  return basics.validate(pda);
}

/**
 * DPDA (Hopcroft, seção 6.4): para todo q, a ∈ Σ ∪ {ε} e X, no máximo uma
 * regra (q, a, X); e se existe regra (q, a, X) com a ∈ Σ, não existe (q, ε, X).
 */
export function classify(pda: PDA): PDAType {
  return basics.classify(pda);
}

/** Simula a palavra no modo `pda.acceptance` e devolve a árvore de IDs e o caminho. */
export function simulate(pda: PDA, word: string, opts?: PDASimulateOptions): PDASimulationResult {
  return sim.simulate(pda, word, opts);
}

/** Atalho: simulate(pda, word, opts).accepted */
export function accepts(pda: PDA, word: string, opts?: PDASimulateOptions): boolean {
  return sim.simulate(pda, word, opts).accepted;
}

/** ID no formato do Hopcroft, com nomes de estado e ε nas partes vazias: "(q1, 011, 0Z)". */
export function formatConfig(pda: PDA, config: PDAConfig): string {
  return basics.formatConfig(pda, config);
}

/** P = (Q, Σ, Γ, δ, q0, Z0, F) pronto para mostrar na tela. */
export function formalDefinition(pda: PDA): PDAFormalDefinition {
  return basics.formalDefinition(pda);
}

/**
 * De estado final para pilha vazia (Hopcroft, Teorema 6.11): devolve P_N com
 * N(P_N) = L(P). Se o AP já aceita por pilha vazia, devolve uma cópia.
 */
export function toEmptyStack(pda: PDA): PDA {
  return conv.toEmptyStack(pda);
}

/**
 * De pilha vazia para estado final (Hopcroft, Teorema 6.9): devolve P_F com
 * L(P_F) = N(P). Se o AP já aceita por estado final, devolve uma cópia.
 */
export function toFinalState(pda: PDA): PDA {
  return conv.toFinalState(pda);
}
