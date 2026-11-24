/** Selo pequeno com o tipo do autômato da aba: AF, AP ou MT. */
import type { AutomatonKind } from '../../core/automaton';

export const KIND_LABEL: Record<AutomatonKind, string> = { fa: 'AF', pda: 'AP', tm: 'MT' };

export const KIND_NAME: Record<AutomatonKind, string> = {
  fa: 'Autômato finito',
  pda: 'Autômato com pilha',
  tm: 'Máquina de Turing',
};

export function KindBadge({ kind, className }: { kind: AutomatonKind; className?: string }) {
  return (
    <span className={`ed-kind ed-kind-${kind}${className ? ` ${className}` : ''}`} title={KIND_NAME[kind]}>
      {KIND_LABEL[kind]}
    </span>
  );
}
