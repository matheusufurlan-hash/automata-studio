/** Janela modal das ferramentas (usa os estilos de janela do editor). */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  label,
  onClose,
  children,
  className = '',
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // o foco fica na janela: as teclas não vazam para os atalhos do editor
    ref.current?.focus();
  }, []);
  return (
    <div className="ed-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        className={`ed-dialog fx-dialog ${className}`}
        role="dialog"
        aria-modal
        aria-label={label}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <button type="button" className="ed-icon-btn sm fx-dialog-x" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
