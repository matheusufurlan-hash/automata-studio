/** Ajudantes dos testes do núcleo (não usar na interface). */
import type { FA, Sym } from './types';
import { FA_EXAMPLES, type FAExample } from './examples';
import { buildGraph } from './internal';
import { acceptsInGraph } from './simulate';

/**
 * Monta um FA curto para teste. Ids = nomes.
 *   fa('q0', ['q2'], ['q0 0 q1', 'q0 01 q0', 'q1 ε q2'], ['q0', 'q1', 'q2'])
 * Cada transição: "de símbolos para" (cada caractere de `símbolos` é um símbolo).
 * Os estados vêm de `states` ou, se omitido, das transições (na ordem em que aparecem).
 */
export function fa(initial: string | null, finals: string[], transitions: string[], states?: string[]): FA {
  const parsed = transitions.map((t) => {
    const [from, symbols, to] = t.split(' ');
    if (!from || symbols === undefined || !to) throw new Error(`transição inválida: ${t}`);
    return { from, symbols: Array.from(symbols), to };
  });
  const names = states ?? [
    ...new Set([...(initial ? [initial] : []), ...parsed.flatMap((t) => [t.from, t.to]), ...finals]),
  ];
  return {
    states: names.map((n) => ({ id: n, name: n, initial: n === initial, final: finals.includes(n) })),
    transitions: parsed.map((t, i) => ({ id: `t${i}`, from: t.from, to: t.to, symbols: t.symbols })),
  };
}

export function example(id: string): FAExample {
  const e = FA_EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`exemplo desconhecido: ${id}`);
  return e;
}

/** Todas as palavras de tamanho 0 a maxLength, em ordem (tamanho, depois alfabética). */
export function allWords(sigma: Sym[], maxLength: number): string[] {
  const result = [''];
  let layer = [''];
  for (let len = 1; len <= maxLength; len++) {
    const next: string[] = [];
    for (const w of layer) for (const c of sigma) next.push(w + c);
    result.push(...next);
    layer = next;
  }
  return result;
}

/** accepts(fa, w) sem remontar o grafo a cada palavra. */
export function acceptor(fa: FA): (word: string) => boolean {
  const g = buildGraph(fa);
  return (word) => acceptsInGraph(g, word);
}

/** Maior tamanho (até `limit`) com no máximo `maxWords` palavras de tamanho 0 até ele. */
export function lengthFor(sigma: Sym[], limit: number, maxWords: number): number {
  let total = 1;
  let power = 1;
  for (let len = 1; len <= limit; len++) {
    power *= Math.max(sigma.length, 1);
    if (total + power > maxWords) return len - 1;
    total += power;
  }
  return limit;
}

/** Palavras aceitas (ordem de `allWords`). */
export function acceptedWords(fa: FA, sigma: Sym[], maxLength: number): string[] {
  const g = buildGraph(fa);
  return allWords(sigma, maxLength).filter((w) => acceptsInGraph(g, w));
}

export interface LanguageSummary {
  counts: number[];
  sha256: string[];
  words?: string[];
}

const compareUtf16 = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** O mesmo resumo que o oráculo grava (ver tools/oraculo/GerarOraculo.java). */
export async function summarize(words: string[], maxLength: number, withWords: boolean): Promise<LanguageSummary> {
  const byLength: string[][] = Array.from({ length: maxLength + 1 }, () => []);
  for (const w of words) byLength[Array.from(w).length]!.push(w);
  const counts = byLength.map((l) => l.length);
  const sha256 = await Promise.all(byLength.map((l) => sha256Hex([...l].sort(compareUtf16).join('\n'))));
  const summary: LanguageSummary = { counts, sha256 };
  if (withWords) summary.words = [...words].sort((a, b) => a.length - b.length || compareUtf16(a, b));
  return summary;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
