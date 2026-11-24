/** Selo do tipo do autômato: AFD, AFN, ε-AFN ou Vazio. */
import type { FAType } from '../../core/fa/types';
import { TYPE_DESCRIPTION, TYPE_LABEL } from './format';

export function TypeBadge({ type, small = false }: { type: FAType; small?: boolean }) {
  return (
    <span className={`fx-type fx-type-${type.toLowerCase()}${small ? ' sm' : ''}`} title={TYPE_DESCRIPTION[type]}>
      {TYPE_LABEL[type]}
    </span>
  );
}
