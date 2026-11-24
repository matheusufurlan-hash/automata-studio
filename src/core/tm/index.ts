/**
 * API pública do núcleo de Máquinas de Turing (MT) — modelo do Hopcroft (cap. 8).
 *
 * As ASSINATURAS fazem parte do contrato (mudar com cuidado).
 * Os CORPOS podem ser divididos em outros arquivos dentro de src/core/tm/.
 *
 * Convenções:
 *  - funções puras: recebem uma TM e devolvem dados NOVOS, sem modificar a entrada;
 *  - regras inválidas (ver validate) e transições penduradas são ignoradas por
 *    todos os algoritmos;
 *  - mais de um estado inicial (arquivo inválido): a simulação usa o PRIMEIRO
 *    (na ordem de `states`); validate avisa;
 *  - nomes em ordem natural: q2 vem antes de q10;
 *  - cada passo aplica EXATAMENTE UMA regra (o YAAS 1.0.7 aplica duas seguidas
 *    quando uma transição tem várias operações — bug que NÃO deve ser copiado);
 *  - não há limite fixo de passos (o YAAS marca como "não para" qualquer MT que
 *    passe de 4000 passos): o limite vem de `opts`, e a resposta diferencia
 *    LOOP (configuração repetida: certamente não para) de STEP_LIMIT (ainda não
 *    se sabe);
 *  - DTM: simulação passo a passo; NTM: busca em largura na árvore de IDs, sem
 *    expandir de novo uma ID repetida, filhos na ordem das transições em
 *    `tm.transitions` e, dentro de cada uma, na ordem de `rules`;
 *  - Os exemplos (convertidos do YAAS) ficam em ./examples (TM_EXAMPLES).
 */
import type {
  Sym,
  TM,
  TMConfig,
  TMFormalDefinition,
  TMIDText,
  TMSimulateOptions,
  TMSimulationResult,
  TMType,
  TMValidationIssue,
} from './types';
import * as basics from './basics';
import * as sim from './simulate';

export * from './types';

/** Γ: todos os símbolos lidos/escritos + B + Σ informado. Ordem alfabética, B por último. */
export function tapeAlphabet(tm: TM): Sym[] {
  return basics.tapeAlphabet(tm);
}

/** Σ: o informado em `tm.inputAlphabet`; se vazio, o palpite Γ − {B}. Ordem alfabética. */
export function inputAlphabet(tm: TM): Sym[] {
  return basics.inputAlphabet(tm);
}

/** Problemas da MT (sem inicial, regra inválida, branco inválido...). */
export function validate(tm: TM): TMValidationIssue[] {
  return basics.validate(tm);
}

/** NTM se algum par (q, X) tem mais de uma regra diferente (somando todas as transições que saem de q). */
export function classify(tm: TM): TMType {
  return basics.classify(tm);
}

/** Simula a palavra no modo `tm.acceptance`. */
export function simulate(tm: TM, word: string, opts?: TMSimulateOptions): TMSimulationResult {
  return sim.simulate(tm, word, opts);
}

/** Atalho: simulate(tm, word, opts).accepted */
export function accepts(tm: TM, word: string, opts?: TMSimulateOptions): boolean {
  return sim.simulate(tm, word, opts).accepted;
}

/** ID no formato do Hopcroft (X1…Xi−1 q Xi…Xn), em partes para a tela destacar o estado. */
export function formatConfig(tm: TM, config: TMConfig): TMIDText {
  return basics.formatConfig(tm, config);
}

/** M = (Q, Σ, Γ, δ, q0, B, F) pronto para mostrar na tela. */
export function formalDefinition(tm: TM): TMFormalDefinition {
  return basics.formalDefinition(tm);
}
