/**
 * Teste em lote: uma palavra por linha (prefixo + ou - = resultado esperado),
 * "Testar tudo", gerar todas as palavras até um tamanho; clicar num resultado
 * carrega a palavra no simulador.
 */
import { useMemo } from 'react';
import { Check, ListRestart, Play, Wand2, X } from 'lucide-react';
import { alphabet } from '../../core/fa';
import { EMPTY_FA, faOf, useActiveDoc } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { formatSet, showWord } from '../ferramentas/format';
import { countWords, summarize } from './batch';
import { GENERATE_LIMIT, useSimulation } from './store';

const PLACEHOLDER = `Uma palavra por linha:
+01      deve aceitar
-10      deve rejeitar
0101     só testar
ε        palavra vazia`;

export function BatchView() {
  const doc = useActiveDoc();
  const text = useSimulation((s) => s.batchText);
  const results = useSimulation((s) => s.batchResults);
  const batchFa = useSimulation((s) => s.batchFa);
  const source = useSimulation((s) => s.batchSource);
  const genLength = useSimulation((s) => s.genLength);
  const sim = useSimulation.getState();
  const fa = faOf(doc) ?? EMPTY_FA;
  const sigma = useMemo(() => alphabet(fa), [fa]);
  const stale = !!results && (batchFa !== fa || source !== text);
  const summary = results ? summarize(results) : null;
  const lines = text.split('\n').filter((l) => l.trim() !== '').length;

  const generate = () => {
    const expected = countWords(sigma.length, genLength);
    const { count, truncated } = sim.generateBatch();
    if (truncated) {
      useEditorUi
        .getState()
        .toast(`Seriam ${Math.round(expected).toLocaleString('pt-BR')} palavras: parei nas primeiras ${count.toLocaleString('pt-BR')}.`, 'info');
    }
  };

  return (
    <div className="sim-batch">
      <div className="sim-batch-left">
        <textarea
          className="sim-batch-text"
          value={text}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          onChange={(e) => sim.setBatchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              sim.runBatch();
            }
          }}
          aria-label="Palavras para testar, uma por linha"
        />
        <div className="sim-batch-actions">
          <button type="button" className="ed-btn primary sm" onClick={() => sim.runBatch()} disabled={lines === 0}>
            <Play size={14} /> Testar tudo
          </button>
          <span className="sim-gen" data-tip={`Todas as palavras sobre Σ = ${formatSet(sigma, ', ')} com até n símbolos`} data-tip-pos="top">
            <button type="button" className="ed-btn sm" onClick={generate} disabled={sigma.length === 0}>
              <Wand2 size={14} /> Gerar até n =
            </button>
            <input
              type="number"
              className="sim-gen-n"
              min={0}
              max={12}
              value={genLength}
              onChange={(e) => sim.setGenLength(Number(e.target.value))}
              aria-label="Tamanho máximo n"
            />
          </span>
          <button
            type="button"
            className="ed-icon-btn sm"
            onClick={() => sim.setBatchText('')}
            disabled={text === ''}
            aria-label="Limpar a lista"
            data-tip="Limpar"
            data-tip-pos="top"
          >
            <ListRestart size={15} />
          </button>
        </div>
      </div>

      <div className="sim-batch-right">
        {!results ? (
          <div className="sim-batch-empty">
            <p>
              Escreva as palavras à esquerda e clique em <b>Testar tudo</b> (Ctrl+Enter). Use <code>+</code> ou <code>-</code> no
              começo da linha para dizer o que você espera; as linhas que não baterem ficam em vermelho.
            </p>
            <p className="muted">Até {GENERATE_LIMIT.toLocaleString('pt-BR')} palavras por vez. Clique num resultado para simular passo a passo.</p>
          </div>
        ) : (
          <>
            <div className="sim-batch-summary">
              <span>
                <b>{summary!.total}</b> {summary!.total === 1 ? 'palavra' : 'palavras'}
              </span>
              <span className="acc">{summary!.accepted} aceitas</span>
              <span className="rej">{summary!.rejected} rejeitadas</span>
              {summary!.passed + summary!.failed > 0 &&
                (summary!.failed === 0 ? (
                  <span className="ok">
                    <Check size={13} /> todas como esperado
                  </span>
                ) : (
                  <span className="bad">
                    <X size={13} /> {summary!.failed} diferente{summary!.failed === 1 ? '' : 's'} do esperado
                  </span>
                ))}
              {stale && <span className="stale">desatualizado: teste de novo</span>}
            </div>
            <div className={stale ? 'sim-batch-list is-stale' : 'sim-batch-list'} role="list">
              {results.map((r) => (
                <button
                  key={`${r.line}`}
                  type="button"
                  role="listitem"
                  className={r.ok === false ? 'sim-batch-item is-bad' : 'sim-batch-item'}
                  onClick={() => {
                    sim.setTab('simulate');
                    sim.load(r.word);
                  }}
                  title={`Linha ${r.line}: clique para simular passo a passo`}
                >
                  <span className={`mark ${r.ok === null ? 'none' : r.ok ? 'ok' : 'bad'}`}>
                    {r.ok === null ? '•' : r.ok ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <span className={r.word === '' ? 'word eps' : 'word'}>{showWord(r.word)}</span>
                  <span className={r.accepted ? 'pill acc' : 'pill rej'}>{r.accepted ? 'ACEITA' : 'REJEITA'}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
