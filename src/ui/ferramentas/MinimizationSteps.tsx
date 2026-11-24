/**
 * Minimização passo a passo: a tabela de pares "em escada" (Hopcroft),
 * rodada por rodada. A rodada atual mostra o símbolo que separou cada par;
 * o mouse em cima da célula explica o porquê.
 */
import { useMemo } from 'react';
import type { FA, MinimizationResult } from '../../core/fa/types';
import { nameMap } from './format';
import { explainPair, markIndex, pairKey, mergedGroups, preparationNotes, roundCaption } from './explain';
import { FloatingTip, Stepper, useTip } from './parts';

export function MinimizationSteps({
  source,
  result,
  pos,
  onChange,
}: {
  source: FA;
  result: MinimizationResult;
  pos: number;
  onChange(pos: number): void;
}) {
  const marks = useMemo(() => markIndex(result), [result]);
  const names = useMemo(() => nameMap(result.input), [result]);
  const prep = useMemo(() => preparationNotes(source, result), [source, result]);
  const groups = useMemo(() => mergedGroups(result), [result]);
  const { tip, show, hide } = useTip();

  const order = result.table.order;
  const rounds = result.table.rounds.length;
  const done = pos >= rounds;
  const n = order.length;
  const label = pos < 0 ? 'Tabela vazia' : done ? 'Fim' : `Rodada ${pos} de ${rounds - 1}`;
  const name = (id: string) => names.get(id) ?? id;

  return (
    <div className="fx-min">
      {prep.length > 0 && (
        <ul className="fx-notes">
          {prep.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <Stepper pos={pos} min={-1} max={rounds} label={label} onChange={onChange} />
      <p className="fx-caption">{roundCaption(result, pos)}</p>

      {n < 2 ? (
        <div className="fx-empty-line">Só um estado: não há pares para comparar.</div>
      ) : (
        <div className="fx-stair-wrap">
          <div
            className="fx-stair"
            style={{ gridTemplateColumns: `auto repeat(${n - 1}, minmax(32px, auto))` }}
            onMouseLeave={hide}
          >
            {order.slice(1).map((rowId, ri) => {
              const i = ri + 1;
              return (
                <div key={rowId} className="fx-stair-row" style={{ display: 'contents' }}>
                  <div className="fx-stair-head row">{name(rowId)}</div>
                  {order.slice(0, n - 1).map((colId, j) => {
                    if (j >= i) return <div key={colId} className="fx-stair-void" />;
                    const m = marks.get(pairKey(rowId, colId));
                    const visible = !!m && m.round <= pos;
                    let cls = 'fx-stair-cell';
                    let text = '';
                    if (visible) {
                      const isNew = m.round === pos;
                      cls += isNew ? ' is-new' : ' is-old';
                      text = isNew && m.mark.symbol ? m.mark.symbol : '×';
                    } else if (done) {
                      cls += ' is-eq';
                      text = '≡';
                    }
                    return (
                      <div
                        key={colId}
                        className={cls}
                        onMouseEnter={(e) => show(e.currentTarget, [explainPair(result, marks, rowId, colId, pos)])}
                        aria-label={`Par {${name(colId)},${name(rowId)}}`}
                      >
                        {text}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="fx-stair-corner" />
            {order.slice(0, n - 1).map((colId) => (
              <div key={colId} className="fx-stair-head col">
                {name(colId)}
              </div>
            ))}
          </div>
        </div>
      )}
      <FloatingTip tip={tip} />

      <div className="fx-legend">
        <span>
          <i className="fx-swatch is-old">×</i> já marcado
        </span>
        <span>
          <i className="fx-swatch is-new">a</i> marcado nesta rodada (símbolo que separou)
        </span>
        <span>
          <i className="fx-swatch is-eq">≡</i> equivalentes
        </span>
      </div>

      {done && (
        <div className="fx-groups">
          <div className="fx-groups-title">Grupos equivalentes → estados do AFD mínimo ({groups.length})</div>
          <div className="fx-groups-list">
            {groups.map((g) => (
              <span key={g.name} className={g.members.length > 1 ? 'fx-group is-merged' : 'fx-group'}>
                {g.members.length > 1 ? g.members.join(' ≡ ') : g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
