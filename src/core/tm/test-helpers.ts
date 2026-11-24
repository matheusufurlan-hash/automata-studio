/** Ajudantes dos testes do núcleo de MT (não usar na interface). */
import type { Sym, TM, TMAcceptance, TMRule, TMSimulationResult } from './types';
import { formatConfig } from './index';
import { idText } from './basics';

/**
 * Regras de 3 caracteres "XYD" (lê X, escreve Y, move D = L ou R), separadas
 * por espaço:  rules('0XR YYR')  =  0/X →  e  Y/Y →
 */
export function rules(spec: string): TMRule[] {
  return spec
    .split(' ')
    .filter((r) => r.length > 0)
    .map((r) => {
      const c = Array.from(r);
      if (c.length !== 3) throw new Error(`regra inválida: ${r}`);
      return { read: c[0]!, write: c[1]!, move: c[2] as TMRule['move'] };
    });
}

/**
 * Monta uma MT curta para teste. Ids = nomes.
 *   tm('q0', ['q2'], ['q0 0XR|YYR q1', 'q1 BBR q2'], { sigma: '01' })
 * Cada transição: "de regras para", com as regras separadas por "|".
 */
export function tm(
  initial: string | null,
  finals: string[],
  transitions: string[],
  opts: { acceptance?: TMAcceptance; blank?: Sym; sigma?: string; states?: string[] } = {},
): TM {
  const parsed = transitions.map((t) => {
    const [from, spec, to] = t.split(' ');
    if (!from || spec === undefined || !to) throw new Error(`transição inválida: ${t}`);
    return { from, rules: rules(spec.split('|').join(' ')), to };
  });
  const names = opts.states ?? [
    ...new Set([...(initial ? [initial] : []), ...parsed.flatMap((t) => [t.from, t.to]), ...finals]),
  ];
  return {
    states: names.map((n) => ({ id: n, name: n, initial: n === initial, final: finals.includes(n) })),
    transitions: parsed.map((t, i) => ({ id: `t${i}`, from: t.from, to: t.to, rules: t.rules })),
    blank: opts.blank ?? 'B',
    acceptance: opts.acceptance ?? 'FINAL_STATE',
    inputAlphabet: Array.from(opts.sigma ?? ''),
  };
}

/** Exemplo 8.2 do Hopcroft: { 0ⁿ1ⁿ | n ≥ 1 }, com a tabela do livro. */
export function hopcroft82(): TM {
  return tm(
    'q0',
    ['q4'],
    ['q0 0XR q1', 'q1 00R|YYR q1', 'q1 1YL q2', 'q2 00L|YYL q2', 'q2 XXR q0', 'q0 YYR q3', 'q3 YYR q3', 'q3 BBR q4'],
    { sigma: '01' },
  );
}

/** As IDs dos passos, no formato do Hopcroft (X1…Xi−1 q Xi…Xn). */
export function ids(machine: TM, r: TMSimulationResult): string[] {
  return r.steps.map((s) => idText(formatConfig(machine, s.config)));
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
