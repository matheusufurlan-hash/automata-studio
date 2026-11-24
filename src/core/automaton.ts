/**
 * CONTRATO — os três tipos de autômato que um documento (aba ou arquivo) pode ter.
 *
 * Arquivos `.automato.json` de AF da rodada 1 continuam válidos sem mudança:
 * a rodada 2 só ACRESCENTA `kind: 'pda'` e `kind: 'tm'` (a versão continua 1).
 *
 * Este arquivo é contrato: o resto do app depende dele, então mude com cuidado.
 */
import type { GraphLike } from './common';
import type { AutomatonFile as FAFile, FA, Layout } from './fa/types';
import type { PDA } from './pda/types';
import type { TM } from './tm/types';

export type AutomatonKind = 'fa' | 'pda' | 'tm';

export type Automaton =
  | { kind: 'fa'; fa: FA }
  | { kind: 'pda'; pda: PDA }
  | { kind: 'tm'; tm: TM };

export type { FAFile };

export interface PDAFile {
  format: 'automatos-studio';
  version: 1;
  kind: 'pda';
  name: string;
  pda: PDA;
  layout: Layout;
}

export interface TMFile {
  format: 'automatos-studio';
  version: 1;
  kind: 'tm';
  name: string;
  tm: TM;
  layout: Layout;
}

/** Formato do `.automato.json` a partir da rodada 2. */
export type AnyAutomatonFile = FAFile | PDAFile | TMFile;

/** Estados e setas de qualquer autômato (para desenho, layout e edição genérica). */
export function graphOf(a: Automaton): GraphLike {
  switch (a.kind) {
    case 'fa':
      return a.fa;
    case 'pda':
      return a.pda;
    case 'tm':
      return a.tm;
  }
}
