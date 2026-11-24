/**
 * AFN → AFD passo a passo: a tabela de subconjuntos, linha por linha.
 * Cada linha é um estado do AFD (um conjunto de estados do AFN); o mouse
 * em cima da célula mostra a conta de δ_D (com o fecho-ε, se houver).
 */
import { useMemo } from 'react';
import type { DeterminizeResult, FA } from '../../core/fa/types';
import { subsetCaption, subsetTable } from './explain';
import { groupSymbols } from './format';
import { FloatingTip, Stepper, useTip } from './parts';

export function SubsetSteps({
  source,
  result,
  pos,
  onChange,
}: {
  source: FA;
  result: DeterminizeResult;
  pos: number;
  onChange(pos: number): void;
}) {
  const table = useMemo(() => subsetTable(source, result), [source, result]);
  const columns = useMemo(
    () => groupSymbols(table.symbols, (i) => table.rows.map((r) => r.cells[i]!.target ?? '').join('\u0001')),
    [table],
  );
  const { tip, show, hide } = useTip();
  const total = table.rows.length;
  const shown = Math.max(0, Math.min(total, pos));

  // linha de cada estado e a célula onde cada conjunto apareceu pela primeira vez
  const { rowIndex, firstSeen } = useMemo(() => {
    const rowIndex = new Map(table.rows.map((r, i) => [r.id, i]));
    const firstSeen = new Map<string, string>(); // id do estado -> "linha:símbolo"
    table.rows.forEach((r, i) => {
      for (const c of r.cells) {
        if (c.target && !firstSeen.has(c.target) && rowIndex.get(c.target)! > i) firstSeen.set(c.target, `${i}:${c.symbol}`);
      }
    });
    return { rowIndex, firstSeen };
  }, [table]);

  // linhas que já apareceram: as processadas + as descobertas por elas
  let visible = 1;
  for (let i = 0; i < shown; i++) {
    for (const c of table.rows[i]!.cells) if (c.target) visible = Math.max(visible, rowIndex.get(c.target)! + 1);
  }

  const label = shown === 0 ? 'Início' : shown >= total ? 'Fim' : `Linha ${shown} de ${total}`;

  return (
    <div className="fx-subsets">
      <Stepper pos={shown} min={0} max={total} label={label} onChange={onChange} />
      <p className="fx-caption">{subsetCaption(table, shown)}</p>
      <div className="fx-table-wrap" onMouseLeave={hide}>
        <table className="fx-table">
          <thead>
            <tr>
              <th className="fx-mark" />
              <th className="fx-rowhead">AFD</th>
              {columns.map((c) => (
                <th key={c.label}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, visible).map((r, i) => {
              const processed = i < shown;
              const current = i === shown - 1;
              return (
                <tr key={r.id} className={current ? 'is-current' : processed ? '' : 'is-pending'}>
                  <td className="fx-mark">
                    {r.initial && <span className="fx-arrow">→</span>}
                    {r.final && <span className="fx-star">*</span>}
                  </td>
                  <th className="fx-rowhead" scope="row" title={`Estados do AFN: ${r.members.length ? r.members.join(', ') : 'nenhum (∅)'}`}>
                    {r.name}
                  </th>
                  {columns.map((col) => {
                    const c = r.cells[col.index]!;
                    if (!processed) return <td key={col.label} className="fx-cell-pending">…</td>;
                    const isNew = col.symbols.some((sym) => firstSeen.get(c.target ?? '') === `${i}:${sym}`);
                    return (
                      <td
                        key={col.label}
                        className={isNew ? 'fx-cell-new' : undefined}
                        onMouseEnter={(e) =>
                          show(
                            e.currentTarget,
                            col.symbols.length > 1 ? [...c.derivation, `(dá o mesmo com ${col.symbols.join(' ')})`] : c.derivation,
                          )
                        }
                      >
                        {c.targetName}
                        {isNew && <span className="fx-new-dot" aria-label="conjunto novo" />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FloatingTip tip={tip} />
      <div className="fx-legend">
        <span>
          <span className="fx-new-dot static" /> conjunto novo (vira uma linha)
        </span>
        <span>passe o mouse numa célula para ver a conta</span>
      </div>
    </div>
  );
}
