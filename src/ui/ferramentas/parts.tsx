/** Peças pequenas do painel lateral: seção recolhível, passo a passo e dica flutuante. */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { SectionId } from './store';
import { useTools } from './store';

export function Section({
  id,
  title,
  aside,
  children,
}: {
  id: SectionId;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const closed = useTools((s) => !!s.closedSections[id]);
  const toggle = useTools((s) => s.toggleSection);
  return (
    <section className={closed ? 'fx-sec is-closed' : 'fx-sec'}>
      <header className="fx-sec-head">
        <button type="button" className="fx-sec-toggle" onClick={() => toggle(id)} aria-expanded={!closed}>
          <ChevronDown size={14} className="fx-sec-chev" />
          {title}
        </button>
        {aside && <span className="fx-sec-aside">{aside}</span>}
      </header>
      {!closed && <div className="fx-sec-body">{children}</div>}
    </section>
  );
}

/** ⏮ ◀ rótulo ▶ ⏭ */
export function Stepper({
  pos,
  min,
  max,
  label,
  onChange,
}: {
  pos: number;
  min: number;
  max: number;
  label: string;
  onChange(pos: number): void;
}) {
  const go = (p: number) => onChange(Math.max(min, Math.min(max, p)));
  return (
    <div className="fx-stepper" role="group" aria-label="Passo a passo">
      <button type="button" className="ed-icon-btn sm" onClick={() => go(min)} disabled={pos <= min} aria-label="Início" data-tip="Início" data-tip-pos="top">
        <ChevronsLeft size={16} />
      </button>
      <button type="button" className="ed-icon-btn sm" onClick={() => go(pos - 1)} disabled={pos <= min} aria-label="Voltar" data-tip="Voltar" data-tip-pos="top">
        <ChevronLeft size={16} />
      </button>
      <span className="fx-stepper-label" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className="ed-icon-btn sm fx-stepper-next"
        onClick={() => go(pos + 1)}
        disabled={pos >= max}
        aria-label="Avançar"
        data-tip="Avançar"
        data-tip-pos="top"
      >
        <ChevronRight size={16} />
      </button>
      <button type="button" className="ed-icon-btn sm" onClick={() => go(max)} disabled={pos >= max} aria-label="Fim" data-tip="Ver tudo" data-tip-pos="top" data-tip-align="end">
        <ChevronsRight size={16} />
      </button>
    </div>
  );
}

const TIP_WIDTH = 300;

export interface Tip {
  x: number;
  y: number;
  lines: string[];
}

/** Dica que segue a célula sob o mouse (x, y = canto de cima, na tela). */
export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (el: HTMLElement, lines: string[]) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(12, Math.min(r.left + r.width / 2 - TIP_WIDTH / 2, window.innerWidth - TIP_WIDTH - 12));
    // cabe embaixo? senão, em cima
    const below = r.bottom + 8;
    const y = below + 120 > window.innerHeight ? Math.max(8, r.top - 8 - 22 * lines.length - 16) : below;
    setTip({ x, y, lines });
  };
  const hide = () => setTip(null);
  return { tip, show, hide };
}

export function FloatingTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="fx-tip" style={{ left: tip.x, top: tip.y, width: TIP_WIDTH }} role="tooltip">
      {tip.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
