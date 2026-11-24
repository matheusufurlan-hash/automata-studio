/** Texto da janela de símbolos ⇄ lista de símbolos. */
import { EPSILON } from '../../core/fa/types';
import type { Sym } from '../../core/fa/types';
import { normalizeSymbols } from '../../store/documents';

/** Cada caractere é um símbolo; espaços e vírgulas são ignorados. "ab, ε" → [a, b, ε]. */
export function parseSymbols(text: string): Sym[] {
  const out: Sym[] = [];
  for (const ch of text) {
    if (ch === ',' || /\s/.test(ch)) continue;
    out.push(ch === 'ϵ' ? EPSILON : ch);
  }
  return normalizeSymbols(out);
}

/** Lista → texto para editar ("a, b, ε"). */
export function symbolsToText(symbols: readonly Sym[]): string {
  return symbols.join(', ');
}
