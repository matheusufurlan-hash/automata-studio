/**
 * Testes de revisão para arquivos e store. Cada `it.fails` mostra um
 * problema encontrado na revisão; quando for corrigido, vira `it`.
 */
import { graphOf } from '../core/automaton';
import { ensureLayout } from '../layout/autoLayout';
import { useDocuments } from '../store/documents';
import { automatonOf, parseAutomatonFile, serializeAutomatonFile } from './fileFormat';

describe('revisor: arquivo e store', () => {
  /**
   * Revisão — "Estado com id 'constructor' (ou 'toString') fica sem posição".
   * O layout é um objeto comum: `positions['constructor']` acha a função
   * Object do protótipo, ensureLayout acha que a posição existe e o estado
   * vai para a tela com posição inválida (NaN).
   */
  it('arquivo com estado de id "constructor" e sem posição ganha uma posição numérica', () => {
    const text = JSON.stringify({
      format: 'automatos-studio',
      version: 1,
      kind: 'fa',
      name: 'x',
      fa: { states: [{ id: 'constructor', name: 'q0', initial: true, final: true }], transitions: [] },
      layout: { positions: {}, edges: {} },
    });
    const file = parseAutomatonFile(text);
    const layout = ensureLayout(graphOf(automatonOf(file)), file.layout);
    expect(typeof layout.positions['constructor']?.x).toBe('number');
  });

  /**
   * Revisão — "Renomear a aba não marca o documento como alterado".
   * O nome vai para o arquivo (campo `name`), mas renomear não acende o `•`
   * nem pede confirmação ao fechar: a mudança se perde sem aviso.
   */
  it('renomear um documento salvo marca como alterado', () => {
    const st = useDocuments.getState();
    st.loadFile(
      parseAutomatonFile(
        serializeAutomatonFile({
          format: 'automatos-studio',
          version: 1,
          kind: 'fa',
          name: 'original',
          fa: { states: [{ id: 'q0', name: 'q0', initial: true, final: false }], transitions: [] },
          layout: { positions: { q0: { x: 0, y: 0 } }, edges: {} },
        }),
      ),
    );
    const id = useDocuments.getState().activeId;
    expect(useDocuments.getState().docs.find((d) => d.id === id)!.dirty).toBe(false);
    useDocuments.getState().renameDoc(id, 'novo nome');
    expect(useDocuments.getState().docs.find((d) => d.id === id)!.dirty).toBe(true);
  });
});
