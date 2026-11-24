/** Peças de menu (menu do clique direito e menu Arquivo). */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Check } from 'lucide-react';

export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="ed-kbd">
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </span>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  keys?: string[];
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

export function MenuItem({ icon, label, keys, checked, danger, disabled, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'ed-menu-item danger' : 'ed-menu-item'}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="ico">{checked ? <Check size={16} className="ed-check" /> : icon}</span>
      <span className="lbl">{label}</span>
      {keys && <Kbd keys={keys} />}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="ed-menu-sep" role="separator" />;
}

/**
 * Superfície flutuante na posição (x, y) da tela; fecha ao clicar fora, Esc,
 * roda do mouse ou redimensionar. Ajusta a posição para não sair da janela.
 */
export function MenuSurface({
  x,
  y,
  title,
  onClose,
  children,
  ignore,
}: {
  x: number;
  y: number;
  title?: string;
  onClose(): void;
  children: ReactNode;
  /** Elemento que não conta como "clicar fora" (ex.: o botão que abriu o menu). */
  ignore?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // mantém o menu dentro da janela (mexe direto no DOM, antes de pintar)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(x, window.innerWidth - r.width - 8);
    const ny = y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height) : y;
    el.style.left = `${Math.max(8, nx)}px`;
    el.style.top = `${ny}px`;
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ignore?.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onWheel = () => onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, ignore]);

  return (
    <div
      ref={ref}
      className="ed-menu"
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {title && <div className="ed-menu-title">{title}</div>}
      {children}
    </div>
  );
}
