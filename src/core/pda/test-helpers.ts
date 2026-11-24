/** Ajudantes dos testes do núcleo de AP (não usar na interface). */
import { EPSILON } from './types';
import type { PDA, PDAAcceptance, PDARule, Sym } from './types';

/**
 * Regras no formato "a,X/γ", separadas por espaço; ε no lugar de `a` = não lê
 * nada, ε no lugar de γ = só desempilha.
 *   rules('0,Z/0Z ε,0/0 1,1/ε')
 */
export function rules(spec: string): PDARule[] {
  return spec
    .split(' ')
    .filter((r) => r.length > 0)
    .map((r) => {
      const c = Array.from(r);
      if (c.length < 4 || c[1] !== ',' || c[3] !== '/') throw new Error(`regra inválida: ${r}`);
      const push = c.slice(4).join('');
      return { read: c[0]!, pop: c[2]!, push: push === EPSILON ? '' : push };
    });
}

/**
 * Monta um AP curto para teste. Ids = nomes.
 *   pda('q0', ['q2'], ['q0 0,Z/0Z|1,Z/1Z q0', 'q0 ε,Z/Z q2'])
 * Cada transição: "de regras para", com as regras separadas por "|".
 * Os estados vêm de `opts.states` ou, se omitido, das transições.
 */
export function pda(
  initial: string | null,
  finals: string[],
  transitions: string[],
  opts: { acceptance?: PDAAcceptance; z0?: Sym; states?: string[] } = {},
): PDA {
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
    startStackSymbol: opts.z0 ?? 'Z',
    acceptance: opts.acceptance ?? 'FINAL_STATE',
  };
}

/** Exemplo 6.2 do Hopcroft (wwᴿ por estado final), com as regras na ordem do livro. */
export function hopcroft62(acceptance: PDAAcceptance = 'FINAL_STATE'): PDA {
  return pda(
    'q0',
    acceptance === 'FINAL_STATE' ? ['q2'] : [],
    [
      'q0 0,Z/0Z|1,Z/1Z|0,0/00|0,1/01|1,0/10|1,1/11 q0',
      'q0 ε,Z/Z|ε,0/0|ε,1/1 q1',
      'q1 0,0/ε|1,1/ε q1',
      acceptance === 'FINAL_STATE' ? 'q1 ε,Z/Z q2' : 'q1 ε,Z/ε q2',
    ],
    { acceptance },
  );
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
