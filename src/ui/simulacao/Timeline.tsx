/** Linha do tempo: {q0} —a→ {q0,q1} —b→ ... Cada passo é clicável. */
import { Fragment, memo, useEffect, useRef } from 'react';
import type { TimelineItem } from './logic';

/** Um passo (memo: em palavras longas só os passos que mudam de estado redesenham). */
const Step = memo(function Step({
  item,
  index,
  cls,
  arrowFuture,
  onPick,
}: {
  item: TimelineItem;
  index: number;
  cls: string;
  arrowFuture: boolean;
  onPick(step: number): void;
}) {
  return (
    <>
      {item.read !== null && (
        <span className={arrowFuture ? 'sim-tl-arrow is-future' : 'sim-tl-arrow'} aria-hidden>
          <span className="sym">{item.read}</span>
          <svg width="17" height="10" viewBox="0 0 17 10">
            <path d="M0 5H15M11 1.5L15.5 5L11 8.5" />
          </svg>
        </span>
      )}
      <button
        type="button"
        role="listitem"
        className={cls}
        onClick={() => onPick(index)}
        title={`Passo ${index}${item.read !== null ? `: leu '${item.read}'` : ': início'}`}
      >
        {item.dead ? (
          '∅'
        ) : (
          <>
            {'{'}
            {item.states.map((s, k) => (
              <Fragment key={s.id}>
                {k > 0 && ','}
                <span className={s.viaEpsilon ? 'via-eps' : undefined}>{s.name}</span>
              </Fragment>
            ))}
            {'}'}
          </>
        )}
      </button>
    </>
  );
});

export function Timeline({
  items,
  step,
  tone,
  onPick,
}: {
  items: TimelineItem[];
  step: number;
  tone: 'running' | 'accepted' | 'rejected';
  onPick(step: number): void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // mantém o passo atual à vista (só rola a própria linha do tempo); de novo
  // se o passo mudar de tamanho (a fonte termina de carregar, por exemplo)
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('.sim-tl-chip.is-current');
    if (!box || !el) return;
    const reveal = () => {
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      if (left < box.scrollLeft + 8 || right > box.scrollLeft + box.clientWidth - 8) {
        const target = Math.max(0, left - box.clientWidth / 2 + el.offsetWidth / 2);
        box.scrollTo?.({ left: target, behavior: Math.abs(target - box.scrollLeft) > box.clientWidth ? 'auto' : 'smooth' });
      }
    };
    reveal();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(reveal);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  if (items.length === 0) return <div className="sim-tl sim-tl-empty">A linha do tempo dos passos aparece aqui.</div>;

  const last = items.length - 1;
  return (
    <div ref={scroller} className="sim-tl" role="list" aria-label="Passos da simulação">
      {items.map((it, i) => {
        const cls = ['sim-tl-chip'];
        if (i === step) cls.push('is-current');
        if (i > step) cls.push('is-future');
        if (i === last && i === step && tone !== 'running') cls.push(`is-${tone}`);
        if (it.dead) cls.push('is-dead');
        return <Step key={i} item={it} index={i} cls={cls.join(' ')} arrowFuture={i > step} onPick={onPick} />;
      })}
    </div>
  );
}
