/**
 * CONTRATO do núcleo de Autômatos com Pilha (AP), no modelo do Hopcroft
 * (cap. 6): P = (Q, Σ, Γ, δ, q0, Z0, F).
 *
 * Cada regra é "a, X / γ": lendo `a` da entrada (ou ε, sem ler nada) com X no
 * TOPO da pilha, o AP desempilha X e empilha γ (o 1º símbolo de γ fica no topo).
 * Não existe "topo ε": toda regra olha (e troca) o topo. Com a pilha vazia,
 * nenhuma regra se aplica.
 *
 * Regras:
 *  - Só dados. Nada de cor, fonte, posição na tela ou React aqui.
 *  - Este arquivo é contrato: o resto do app depende dele, então mude com cuidado.
 *  - Todas as funções do núcleo são puras.
 */
import type { IDNode, Layout, StateId, Sym, TransitionId } from '../common';

export { EPSILON } from '../common';
export type { IDNode, IDStatus, Layout, RuleRef, StateId, Sym, TransitionId } from '../common';

/** Z0 padrão de um AP novo (o YAAS também usa Z). */
export const DEFAULT_START_STACK_SYMBOL = 'Z';

/** Limite padrão de IDs na árvore de simulação. */
export const PDA_DEFAULT_MAX_NODES = 5000;

export interface PDAState {
  id: StateId;
  name: string;
  initial: boolean;
  final: boolean;
}

/** Uma regra "a, X / γ". Todo símbolo (de Σ ou de Γ) tem exatamente 1 caractere. */
export interface PDARule {
  /** a: 1 caractere de Σ, ou EPSILON (não lê nada da entrada). */
  read: Sym;
  /** X: 1 caractere de Γ. É SEMPRE desempilhado. EPSILON aqui é inválido. */
  pop: Sym;
  /**
   * γ: o que entra no lugar de X, 1 caractere por símbolo de Γ.
   * O PRIMEIRO caractere fica no TOPO. '' = ε (só desempilha).
   * Ex.: pop 'Z', push '0Z' → o 0 fica em cima do Z.
   */
  push: string;
}

/**
 * Uma seta de `from` para `to` com uma ou mais regras.
 * Invariante (garantida pela interface e pelo núcleo nas suas saídas):
 * no máximo UMA transição por par (from, to), sem regras repetidas.
 * O núcleo aceita entradas com pares repetidos mesmo assim (une as regras).
 */
export interface PDATransition {
  id: TransitionId;
  from: StateId;
  to: StateId;
  rules: PDARule[];
}

/** Por estado final: L(P). Por pilha vazia: N(P). (Hopcroft, seção 6.2) */
export type PDAAcceptance = 'FINAL_STATE' | 'EMPTY_STACK';

export interface PDA {
  states: PDAState[];
  transitions: PDATransition[];
  /** Z0: 1 caractere. */
  startStackSymbol: Sym;
  /** Modo de aceitação deste AP (usado pela simulação). */
  acceptance: PDAAcceptance;
}

/** EMPTY = sem estados. DPDA = determinístico (Hopcroft, seção 6.4). */
export type PDAType = 'EMPTY' | 'DPDA' | 'PDA';

/** Descrição instantânea (ID) do Hopcroft: (q, w, γ). */
export interface PDAConfig {
  state: StateId;
  /** w: o que falta ler da palavra. */
  remaining: string;
  /** γ: a pilha, TOPO PRIMEIRO. '' = pilha vazia. */
  stack: string;
}

export type PDAIDNode = IDNode<PDAConfig>;

export type PDARejectReason =
  /** AP sem estado inicial. */
  | 'NO_INITIAL_STATE'
  /** A palavra tem um símbolo que nenhuma regra lê. */
  | 'SYMBOL_NOT_IN_ALPHABET'
  /** A busca terminou: todos os ramos morreram ou se repetiram sem aceitar. */
  | 'NO_ACCEPTING_PATH'
  /** A busca bateu no limite de IDs sem aceitar (pode ser que aceite com uma busca maior). */
  | 'LIMIT_REACHED';

export interface PDASimulateOptions {
  /** Máximo de IDs na árvore (padrão PDA_DEFAULT_MAX_NODES). */
  maxNodes?: number;
  /** true = continua a busca depois de aceitar, para montar a árvore inteira (padrão false). */
  exploreAll?: boolean;
}

export interface PDASimulationResult {
  accepted: boolean;
  /** Modo usado (o `acceptance` do AP). */
  acceptance: PDAAcceptance;
  /**
   * Árvore de IDs. A raiz é (q0, palavra, Z0). Vazia só em NO_INITIAL_STATE;
   * em SYMBOL_NOT_IN_ALPHABET tem só a raiz.
   */
  tree: PDAIDNode[];
  /**
   * Índices em `tree`, da raiz até a ID que aceitou. Quando rejeita: da raiz
   * até a ID que leu MAIS da palavra (empate: a primeira da busca em largura).
   * É o caminho que o painel anima passo a passo. Vazio em NO_INITIAL_STATE.
   */
  path: number[];
  /** true = a busca parou no limite (há nós UNEXPLORED por causa disso). */
  limitReached: boolean;
  /**
   * true = quem parou a busca foi a proteção de memória (as pilhas da árvore
   * ficaram grandes demais), não o `maxNodes`: buscar com um limite maior não
   * adianta. Só aparece junto com `limitReached`.
   */
  memoryLimit?: boolean;
  /** Só quando accepted === false. */
  reason?: PDARejectReason;
  /** Posição (0-based) do 1º símbolo fora de Σ, em SYMBOL_NOT_IN_ALPHABET. */
  stoppedAt?: number;
}

export interface PDAFormalDefinition {
  /** Nomes dos estados (ordem natural: q2 antes de q10). */
  states: string[];
  /** Σ, sem ε, em ordem alfabética. */
  inputAlphabet: Sym[];
  /** Γ (inclui Z0), em ordem alfabética. */
  stackAlphabet: Sym[];
  /** Uma linha por (q, a, X) que tem destino: δ(q, a, X) = {(p, γ), ...}. push '' = ε. */
  delta: Array<{ from: string; read: Sym; pop: Sym; to: Array<{ state: string; push: string }> }>;
  initial: string | null;
  startStackSymbol: Sym;
  finals: string[];
  acceptance: PDAAcceptance;
  type: PDAType;
}

export type PDAValidationIssue =
  | { kind: 'NO_INITIAL_STATE' }
  | { kind: 'MULTIPLE_INITIAL_STATES'; states: StateId[] }
  | { kind: 'DANGLING_TRANSITION'; transition: TransitionId }
  | { kind: 'DUPLICATE_NAME'; name: string; states: StateId[] }
  /** `read` não é 1 caractere nem ε. */
  | { kind: 'INVALID_READ'; transition: TransitionId; rule: number }
  /** `pop` não é exatamente 1 caractere (ε não vale no modelo do Hopcroft). */
  | { kind: 'INVALID_POP'; transition: TransitionId; rule: number }
  /** `push` contém ε (o vazio é a string ''). */
  | { kind: 'INVALID_PUSH'; transition: TransitionId; rule: number }
  /** Z0 não é exatamente 1 caractere (ou é ε). */
  | { kind: 'INVALID_START_STACK_SYMBOL' };

/** Exemplo pronto (galeria). */
export interface PDAExample {
  id: string;
  name: string;
  description: string;
  pda: PDA;
  layout: Layout;
  /** Palavras de teste com a resposta certa (para o teste em lote). */
  samples?: Array<{ word: string; accepted: boolean }>;
}
