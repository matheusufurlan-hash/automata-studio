/** Molduras das janelas do editor: cartão ancorado perto do clique e janela central. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useEditorUi } from '../../store/editorUi';

export const closeDialog = () => useEditorUi.getState().closeDialog();

/**
 * Cartão ancorado perto de (x, y) da tela, sem sair da janela. Se o conteúdo
 * crescer (ex.: mais regras), ele se reposiciona para continuar visível.
 */
export function Anchored({
  x,
  y,
  children,
  label,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let above: boolean | null = null;
    const place = () => {
      const r = el.getBoundingClientRect();
      const left = Math.max(12, Math.min(x - r.width / 2, window.innerWidth - r.width - 12));
      const below = y + 18;
      // o lado (embaixo/em cima do clique) é escolhido uma vez só, para o cartão não pular
      above ??= below + r.height > window.innerHeight - 12;
      const top = above ? y - r.height - 18 : below;
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(12, Math.min(top, window.innerHeight - r.height - 12))}px`;
    };
    place();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [x, y]);
  return (
    <div className="ed-overlay is-clear" onPointerDown={(e) => e.target === e.currentTarget && closeDialog()}>
      <div
        ref={ref}
        className={className ? `ed-dialog ${className}` : 'ed-dialog'}
        role="dialog"
        aria-label={label}
        style={{ left: x, top: y }}
      >
        {children}
      </div>
    </div>
  );
}

export function Modal({
  children,
  label,
  onClose = closeDialog,
  wide = false,
}: {
  children: ReactNode;
  label: string;
  onClose?: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ed-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'ed-dialog wide' : 'ed-dialog'} role="dialog" aria-modal aria-label={label}>
        {children}
      </div>
    </div>
  );
}
