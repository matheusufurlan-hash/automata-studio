/**
 * Teste em lote (funções puras): ler a lista de palavras, gerar todas as
 * palavras até um tamanho e conferir o resultado de cada uma.
 *
 * Formato da lista: uma palavra por linha.
 *  - `+palavra` = deve ACEITAR; `-palavra` = deve REJEITAR (o prefixo é opcional);
 *  - `ε` (ou só o prefixo, como `+`) = palavra vazia; linhas em branco são ignoradas;
 *  - se `+` ou `-` fizer parte de Σ, `+0` é a palavra "+0": para indicar o
 *    esperado nesse caso, separe com um espaço (`+ +0`).
 */
import { EPSILON } from '../../core/fa/types';
import type { FA, Sym } from '../../core/fa/types';
import { simulate } from '../../core/fa';

export interface BatchEntry {
  /** Linha no texto (1-based). */
  line: number;
  word: string;
  /** true = deve aceitar; false = deve rejeitar; null = sem esperado. */
  expected: boolean | null;
}

export function parseBatch(text: string, sigma: readonly Sym[] = []): BatchEntry[] {
  const inSigma = new Set(sigma);
  const out: BatchEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') return;
    let expected: boolean | null = null;
    let rest = line;
    const first = line[0]!;
    if (first === '+' || first === '-') {
      const next = line[1];
      const spaced = next === undefined || /\s/.test(next);
      if (spaced || !inSigma.has(first)) {
        expected = first === '+';
        rest = line.slice(1).trim();
      }
    }
    // ε é a palavra vazia: "ε" sozinho = vazia, "0ε1" = "01"; espaços não contam
    const word = rest.replace(/\s+/g, '').split(EPSILON).join('');
    out.push({ line: i + 1, word, expected });
  });
  return out;
}

/** Volta a lista para texto (o inverso de parseBatch, para preencher a caixa). */
export function formatBatch(entries: readonly Pick<BatchEntry, 'word' | 'expected'>[]): string {
  return entries
    .map((e) => `${e.expected === null ? '' : e.expected ? '+' : '-'}${e.word === '' ? EPSILON : e.word}`)
    .join('\n');
}

export interface GeneratedWords {
  words: string[];
  /** Parou antes por causa do limite. */
  truncated: boolean;
}

/**
 * Todas as palavras sobre Σ com tamanho 0..maxLen, em ordem de tamanho e
 * depois alfabética (ε, 0, 1, 00, 01, ...). Para no `limit`.
 */
export function generateWords(sigma: readonly Sym[], maxLen: number, limit = 2000): GeneratedWords {
  const symbols = [...new Set(sigma)].filter((s) => s !== EPSILON).sort();
  const words: string[] = [''];
  if (limit <= 0) return { words: [], truncated: true };
  let layer = [''];
  for (let len = 1; len <= maxLen && symbols.length > 0; len++) {
    const next: string[] = [];
    for (const prefix of layer) {
      for (const s of symbols) {
        if (words.length >= limit) return { words, truncated: true };
        const w = prefix + s;
        next.push(w);
        words.push(w);
      }
    }
    layer = next;
  }
  return { words, truncated: false };
}

/** Quantas palavras generateWords produziria (para avisar antes). */
export function countWords(sigmaSize: number, maxLen: number): number {
  if (sigmaSize <= 1) return maxLen + 1;
  return (Math.pow(sigmaSize, maxLen + 1) - 1) / (sigmaSize - 1);
}

export interface BatchResult extends BatchEntry {
  accepted: boolean;
  /** true = bateu com o esperado; false = diferente; null = sem esperado. */
  ok: boolean | null;
}

export function runBatch(fa: FA, entries: readonly BatchEntry[]): BatchResult[] {
  return entries.map((e) => {
    const accepted = simulate(fa, e.word).accepted;
    return { ...e, accepted, ok: e.expected === null ? null : e.expected === accepted };
  });
}

export interface BatchSummary {
  total: number;
  accepted: number;
  rejected: number;
  /** Com esperado e iguais ao esperado. */
  passed: number;
  /** Com esperado e diferentes do esperado. */
  failed: number;
}

export function summarize(results: readonly BatchResult[]): BatchSummary {
  let accepted = 0;
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.accepted) accepted++;
    if (r.ok === true) passed++;
    if (r.ok === false) failed++;
  }
  return { total: results.length, accepted, rejected: results.length - accepted, passed, failed };
}
