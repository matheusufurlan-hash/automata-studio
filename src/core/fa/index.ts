/**
 * API pública do núcleo de Autômatos Finitos.
 *
 * As ASSINATURAS fazem parte do contrato (mudar com cuidado).
 * Os CORPOS podem ser divididos em outros arquivos dentro de src/core/fa/.
 *
 * Convenções para autômatos GERADOS pelo núcleo:
 *  - ids e nomes novos: "q0", "q1", ... na ordem de uma busca em largura a
 *    partir do estado inicial (símbolos em ordem alfabética);
 *  - exceções: determinize nomeia como "{q0,q1}" (conjunto vazio = "∅") e
 *    minimize nomeia como "{q0,q2}" quando junta estados (estado sozinho mantém o nome);
 *  - estado morto criado por complete/complement: nome "∅" se não houver conflito;
 *  - no máximo uma transição por par (from, to), símbolos em ordem alfabética.
 *
 * Detalhes da implementação:
 *  - ids de transição gerados: "t0", "t1", ...;
 *  - complete, removeUnreachable, removeUseless e complement (quando já recebe
 *    um AFD) MANTÊM ids e nomes; o estado morto novo ganha o primeiro id
 *    "qN" livre;
 *  - transições penduradas e símbolos inválidos (validate) são ignorados por
 *    todos os algoritmos;
 *  - mais de um estado inicial (arquivo inválido): todos valem como início
 *    (como num AFN); validate avisa;
 *  - nomes em ordem natural: q2 vem antes de q10.
 *  - Os exemplos do YAAS ficam em ./examples (FA_EXAMPLES).
 */
import type {
  DeterminizeResult,
  EquivalenceResult,
  FA,
  FAType,
  FormalDefinition,
  MinimizationResult,
  SimulationResult,
  StateId,
  Sym,
  ValidationIssue,
} from './types';
import * as basics from './basics';
import * as det from './determinize';
import * as min from './minimize';
import * as ops from './operations';
import * as sim from './simulate';

export * from './types';

/** Σ: todos os símbolos usados nas transições, sem ε, em ordem alfabética. */
export function alphabet(fa: FA): Sym[] {
  return basics.alphabet(fa);
}

/** Problemas que impedem simular (sem inicial, símbolo com mais de 1 caractere...). */
export function validate(fa: FA): ValidationIssue[] {
  return basics.validate(fa);
}

/** DFA: sem ε e no máximo um destino por (estado, símbolo). Função parcial ainda é DFA. */
export function classify(fa: FA): FAType {
  return basics.classify(fa);
}

/** Fecho-ε (ECLOSE) de um estado ou de um conjunto. Inclui os próprios estados. */
export function eclose(fa: FA, from: StateId | StateId[]): StateId[] {
  return basics.eclose(fa, from);
}

/** Simula a palavra e devolve TODOS os passos (serve para AFD, AFN e ε-AFN). */
export function simulate(fa: FA, word: string): SimulationResult {
  return sim.simulate(fa, word);
}

/** Atalho: simulate(fa, word).accepted */
export function accepts(fa: FA, word: string): boolean {
  return sim.accepts(fa, word);
}

/** Construção de subconjuntos (com fecho-ε). Só estados alcançáveis. */
export function determinize(fa: FA): DeterminizeResult {
  return det.determinize(fa);
}

/**
 * Minimização pelo método da tabela (Hopcroft). Se receber AFN/ε-AFN,
 * determiniza antes. Remove inalcançáveis e completa antes de montar a tabela.
 */
export function minimize(fa: FA): MinimizationResult {
  return min.minimize(fa);
}

/** Torna a função de transição total, criando um estado morto se preciso. */
export function complete(fa: FA, sigma?: Sym[]): FA {
  return ops.complete(fa, sigma);
}

/** Complemento em relação a `sigma` (padrão: alfabeto do próprio FA). Determiniza antes. */
export function complement(fa: FA, sigma?: Sym[]): FA {
  return ops.complement(fa, sigma);
}

/** L(a) ∪ L(b) — novo inicial com ε para os dois. */
export function union(a: FA, b: FA): FA {
  return ops.union(a, b);
}

/** L(a)·L(b) — finais de a ganham ε para o inicial de b. */
export function concat(a: FA, b: FA): FA {
  return ops.concat(a, b);
}

/** L(a)* — aceita ε. */
export function star(a: FA): FA {
  return ops.star(a);
}

/** L(a) ∩ L(b) — produto de AFDs. */
export function intersection(a: FA, b: FA): FA {
  return ops.intersection(a, b);
}

/** Remove estados que não são alcançáveis a partir do inicial. */
export function removeUnreachable(fa: FA): FA {
  return ops.removeUnreachable(fa);
}

/** Remove inalcançáveis E estados que não chegam a nenhum final (inúteis). */
export function removeUseless(fa: FA): FA {
  return ops.removeUseless(fa);
}

/** Q, Σ, δ, q0, F prontos para mostrar na tela. */
export function formalDefinition(fa: FA): FormalDefinition {
  return basics.formalDefinition(fa);
}

/** Compara as linguagens; se diferentes, devolve o menor contraexemplo. */
export function equivalent(a: FA, b: FA): EquivalenceResult {
  return ops.equivalent(a, b);
}
