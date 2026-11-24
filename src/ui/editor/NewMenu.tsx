/**
 * Menu "Novo": autômato finito (AF), autômato com pilha (AP) ou máquina de
 * Turing (MT). Abre pelo botão + das abas ou com Alt+N; dentro do menu, as
 * teclas F, P e T escolhem o tipo.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { AutomatonKind } from '../../core/automaton';
import { newDocument } from './fileActions';
import { KIND_NAME, KindBadge } from './KindBadge';
import { MenuItem, MenuSurface } from './Menu';

export const NEW_KINDS: ReadonlyArray<{ kind: AutomatonKind; key: string }> = [
  { kind: 'fa', key: 'F' },
  { kind: 'pda', key: 'P' },
  { kind: 'tm', key: 'T' },
];

export function NewMenu({
  x,
  y,
  onClose,
  ignore,
}: {
  x: number;
  y: number;
  onClose(): void;
  ignore?: RefObject<HTMLElement | null>;
}) {
  // F / P / T escolhem sem precisar do mouse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const item = NEW_KINDS.find((k) => `Key${k.key}` === e.code);
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
      newDocument(item.kind);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <MenuSurface x={x} y={y} title="Novo" onClose={onClose} ignore={ignore}>
      {NEW_KINDS.map(({ kind, key }) => (
        <MenuItem
          key={kind}
          icon={<KindBadge kind={kind} />}
          label={KIND_NAME[kind]}
          keys={[key]}
          onSelect={() => {
            onClose();
            newDocument(kind);
          }}
        />
      ))}
    </MenuSurface>
  );
}
