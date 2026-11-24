/**
 * Testes de revisão para a simulação. Cada `it.fails` mostra um
 * problema encontrado na revisão; quando for corrigido, vira `it`.
 */
import { star } from '../../core/fa';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { useDocuments } from '../../store/documents';
import { parseBatch } from './batch';
import { useSimulation } from './store';

describe('revisor: simulação', () => {
  /**
   * Revisão — "Digitar ε no campo da palavra rejeita (símbolo fora de Σ)".
   * O campo mostra "ε (palavra vazia)" como dica e o Teste em lote trata "ε"
   * como a palavra vazia, mas o simulador trata "ε" como um símbolo.
   * Aqui o autômato é L(termina em 01)*, que ACEITA a palavra vazia.
   */
  it('o campo da palavra trata "ε" como a palavra vazia (igual ao Teste em lote)', () => {
    const base = FA_EXAMPLES.find((e) => e.id === 'afd-termina-01')!.fa;
    useDocuments.getState().openInNewTab('estrela', star(base));
    expect(parseBatch('ε')[0]!.word).toBe('');
    useSimulation.getState().load('');
    expect(useSimulation.getState().result!.accepted).toBe(true);
    useSimulation.getState().load('ε');
    const r = useSimulation.getState().result!;
    expect(r.reason).not.toBe('SYMBOL_NOT_IN_ALPHABET');
    expect(r.accepted).toBe(true);
  });
});
