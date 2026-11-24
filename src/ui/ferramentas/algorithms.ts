/**
 * Algoritmos do menu (funções puras): quando cada um faz sentido, o nome do
 * resultado e uma explicação curta do que foi feito (para o painel lateral).
 */
import {
  alphabet,
  classify,
  complement,
  complete,
  concat,
  determinize,
  intersection,
  minimize,
  removeUnreachable,
  removeUseless,
  star,
  union,
} from '../../core/fa';
import type { DeterminizeResult, FA, MinimizationResult } from '../../core/fa/types';
import type { PDA } from '../../core/pda/types';
import type { PDAAlgo } from './pdaAlgorithms';
import { formatSet, namesOf, sortByName } from './format';

export type UnaryAlgo =
  | 'determinize'
  | 'minimize'
  | 'complete'
  | 'complement'
  | 'removeUnreachable'
  | 'removeUseless'
  | 'star';
export type BinaryAlgo = 'union' | 'concat' | 'intersection';
export type AlgoId = UnaryAlgo | BinaryAlgo | 'equivalence';

export const ALGO_LABEL: Record<AlgoId, string> = {
  determinize: 'AFN → AFD',
  minimize: 'Minimizar',
  complete: 'Completar (estado morto)',
  complement: 'Complemento',
  removeUnreachable: 'Remover inalcançáveis',
  removeUseless: 'Remover inúteis',
  star: 'Fecho de Kleene',
  union: 'União',
  concat: 'Concatenação',
  intersection: 'Interseção',
  equivalence: 'Comparar equivalência',
};

export const BINARY_SYMBOL: Record<BinaryAlgo, string> = { union: '∪', concat: '·', intersection: '∩' };

/** De onde veio o AF de uma aba (resultado de algoritmo de AF). */
export type FAProvenance =
  | { kind: 'determinize'; fa: FA; source: FA; sourceName: string; result: DeterminizeResult }
  | { kind: 'minimize'; fa: FA; source: FA; sourceName: string; result: MinimizationResult }
  | { kind: 'other'; fa: FA; algo: AlgoId; title: string; notes: string[] };

/** De onde veio o autômato de uma aba (para o painel lateral explicar). */
export type Provenance =
  | FAProvenance
  /** Conversão de AP (Teoremas 6.9 e 6.11). */
  | { kind: 'pda'; pda: PDA; algo: PDAAlgo; title: string; notes: string[] };

export interface AlgoOutput {
  name: string;
  fa: FA;
  provenance: FAProvenance;
  /** Aviso curto depois de rodar (ex.: "Já era mínimo"). */
  message: string;
}

const hasInitial = (fa: FA) => fa.states.some((s) => s.initial);

/** O AFD já tem destino para todo estado e todo símbolo de Σ? */
export function isComplete(fa: FA): boolean {
  const sigma = alphabet(fa);
  const ids = new Set(fa.states.map((s) => s.id));
  const has = new Set<string>();
  for (const t of fa.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) continue;
    for (const s of t.symbols) has.add(`${t.from}\u0000${s}`);
  }
  return fa.states.every((st) => sigma.every((s) => has.has(`${st.id}\u0000${s}`)));
}

/**
 * Por que o algoritmo NÃO pode rodar agora (null = pode).
 * `others` = autômatos das outras abas (para os algoritmos com 2 autômatos).
 */
export function unavailableReason(id: AlgoId, fa: FA, others: readonly FA[] = []): string | null {
  if (fa.states.length === 0) return 'o autômato está vazio';
  if (id === 'complete') {
    if (classify(fa) !== 'DFA') return 'só para AFD (use AFN → AFD antes)';
    if (isComplete(fa)) return 'já está completo';
    return null;
  }
  if (!hasInitial(fa)) return 'sem estado inicial';
  switch (id) {
    case 'determinize':
      return classify(fa) === 'DFA' ? 'já é um AFD' : null;
    case 'removeUnreachable':
      return removeUnreachable(fa).states.length === fa.states.length ? 'não há estados inalcançáveis' : null;
    case 'removeUseless': {
      const r = removeUseless(fa);
      if (r.states.length === fa.states.length) return 'não há estados inúteis';
      if (r.states.length === 0) return 'a linguagem é vazia: não sobraria nenhum estado';
      return null;
    }
    case 'union':
    case 'concat':
    case 'intersection':
    case 'equivalence':
      return others.some((o) => o.states.length > 0 && hasInitial(o)) ? null : 'abra outro autômato numa aba';
    default:
      return null;
  }
}

/** Lista "D, E e F". */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function runUnary(id: UnaryAlgo, name: string, fa: FA): AlgoOutput {
  const n = fa.states.length;
  switch (id) {
    case 'determinize': {
      const result = determinize(fa);
      const m = result.dfa.states.length;
      const dead = Object.values(result.subsets).some((s) => s.length === 0);
      return {
        name: `AFD de ${name}`,
        fa: result.dfa,
        provenance: { kind: 'determinize', fa: result.dfa, source: fa, sourceName: name, result },
        message: `AFD com ${plural(m, 'estado', 'estados')}${dead ? ' (inclui ∅)' : ''}.`,
      };
    }
    case 'minimize': {
      const result = minimize(fa);
      const original = fa.states.length;
      const m = result.dfa.states.length;
      const states = plural(m, 'estado', 'estados');
      // compara com o que o aluno desenhou, não com o AFD já completado
      const message =
        classify(fa) !== 'DFA'
          ? `AFD mínimo com ${states} (o autômato original tinha ${original}).`
          : m < original
            ? `Mínimo com ${states} (o AFD tinha ${original}).`
            : m === original
              ? `Já era mínimo: ${states}.`
              : `Mínimo completo com ${states}: foi preciso o estado morto (o AFD parcial tinha ${original}).`;
      return {
        name: `Mínimo de ${name}`,
        fa: result.dfa,
        provenance: { kind: 'minimize', fa: result.dfa, source: fa, sourceName: name, result },
        message,
      };
    }
    case 'complete': {
      const out = complete(fa);
      const added = out.states.filter((s) => !fa.states.some((o) => o.id === s.id));
      const dead = added[0]?.name ?? '∅';
      return other(`${name} (completo)`, out, id, `Completar ${name}`, [
        `As transições que faltavam agora vão para o estado morto ${dead}.`,
        `${dead} não é final e tem laço com todos os símbolos de Σ = ${formatSet(alphabet(fa), ', ')}: quem cai nele nunca mais sai.`,
      ], `Estado morto ${dead} criado.`);
    }
    case 'complement': {
      const out = complement(fa);
      const notes = [
        `Aceita exatamente as palavras sobre Σ = ${formatSet(alphabet(fa), ', ')} que ${name} rejeita.`,
        'Como foi feito: AFD completo (com estado morto, se faltava transição) e os estados finais trocados pelos não finais.',
      ];
      if (classify(fa) !== 'DFA') notes.push('O AFN foi determinizado antes: trocar os finais de um AFN não dá o complemento.');
      return other(`Complemento de ${name}`, out, id, `Complemento de ${name}`, notes, `Complemento com ${plural(out.states.length, 'estado', 'estados')}.`);
    }
    case 'removeUnreachable': {
      const out = removeUnreachable(fa);
      const gone = removedNames(fa, out);
      return other(`${name} sem inalcançáveis`, out, id, `${name} sem inalcançáveis`, [
        `Removidos: ${listNames(gone)}. Nenhum caminho a partir do estado inicial chega neles, então não mudam a linguagem.`,
      ], `${plural(gone.length, 'estado removido', 'estados removidos')}.`);
    }
    case 'removeUseless': {
      const reachable = removeUnreachable(fa);
      const out = removeUseless(fa);
      const unreachable = removedNames(fa, reachable);
      const dead = removedNames(reachable, out);
      const notes: string[] = [];
      if (unreachable.length) notes.push(`Inalcançáveis (o inicial não chega neles): ${listNames(unreachable)}.`);
      if (dead.length) notes.push(`Não chegam a nenhum estado final: ${listNames(dead)}.`);
      notes.push('Um estado é útil quando está em algum caminho do inicial até um final.');
      return other(`${name} sem inúteis`, out, id, `${name} sem inúteis`, notes, `${plural(n - out.states.length, 'estado removido', 'estados removidos')}.`);
    }
    case 'star': {
      const out = star(fa);
      return other(`(${name})*`, out, id, `Fecho de Kleene de ${name}`, [
        'Um estado inicial novo, que também é final (por isso aceita ε), com transição ε para o inicial antigo.',
        'Cada estado final ganhou uma transição ε de volta para o inicial novo: dá para repetir quantas vezes quiser.',
      ], `Fecho de Kleene com ${plural(out.states.length, 'estado', 'estados')}.`);
    }
  }
}

export function runBinary(id: BinaryAlgo, nameA: string, a: FA, nameB: string, b: FA): AlgoOutput {
  const sym = BINARY_SYMBOL[id];
  const name = `${nameA} ${sym} ${nameB}`;
  switch (id) {
    case 'union': {
      const out = union(a, b);
      return other(name, out, id, `União: L(${nameA}) ∪ L(${nameB})`, [
        `Um estado inicial novo com transições ε para o inicial de ${nameA} e para o de ${nameB}: o autômato "escolhe" qual dos dois seguir.`,
        'Aceita se pelo menos um dos dois aceitar.',
      ], `União com ${plural(out.states.length, 'estado', 'estados')}.`);
    }
    case 'concat': {
      const out = concat(a, b);
      return other(name, out, id, `Concatenação: L(${nameA}) · L(${nameB})`, [
        `Cada estado final de ${nameA} ganhou uma transição ε para o inicial de ${nameB}; só os finais de ${nameB} continuam finais.`,
        `Aceita uma palavra de ${nameA} seguida de uma palavra de ${nameB}.`,
      ], `Concatenação com ${plural(out.states.length, 'estado', 'estados')}.`);
    }
    case 'intersection': {
      const out = intersection(a, b);
      return other(name, out, id, `Interseção: L(${nameA}) ∩ L(${nameB})`, [
        `Construção do produto: cada estado é um par (p, q), com p de ${nameA} e q de ${nameB}, lendo o mesmo símbolo nos dois ao mesmo tempo.`,
        'Um par é final quando p e q são finais (os dois aceitam). AFNs são determinizados antes.',
      ], `Interseção com ${plural(out.states.length, 'estado', 'estados')}.`);
    }
  }
}

function other(name: string, fa: FA, algo: AlgoId, title: string, notes: string[], message: string): AlgoOutput {
  return { name, fa, provenance: { kind: 'other', fa, algo, title, notes }, message };
}

/** Nomes dos estados de `before` que não existem mais em `after` (por id). */
function removedNames(before: FA, after: FA): string[] {
  const kept = new Set(after.states.map((s) => s.id));
  return namesOf(before, sortByName(before, before.states.filter((s) => !kept.has(s.id)).map((s) => s.id)));
}
