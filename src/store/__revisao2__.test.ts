/**
 * Testes de revisão da versão 0.2 — store de documentos (AP e MT).
 * Cada `it.fails` demonstra um problema encontrado na revisão; quando
 * o problema for corrigido, o teste passa a "falhar" e deve virar `it`.
 */
import { PDA_EXAMPLES } from '../core/pda/examples';
import { simulate as simulatePDA } from '../core/pda';
import { simulate as simulateTM } from '../core/tm';
import { TM_EXAMPLES } from '../core/tm/examples';
import { fileOf } from '../platform/fileFormat';
import { getActiveDoc, pdaOf, tmOf, useDocuments } from './documents';

const words01 = ['', '0', '1', '00', '01', '10', '11', '001', '010', '011', '0011', '0101', '0110', '1100', '000111'];

describe('revisor 2: Propriedades — trocar Z0 / branco "nas regras também"', () => {
  it('AP: trocar Z0 por um símbolo que JÁ está em Γ (caixa marcada, o padrão) não pode mudar a linguagem sem aviso', () => {
    const ex = PDA_EXAMPLES.find((e) => e.id === 'ap-0n1n')!; // Γ = {X, Z}
    useDocuments.getState().loadFile(fileOf(ex.name, { kind: 'pda', pda: ex.pda }, ex.layout), { template: true });
    const before = words01.map((w) => simulatePDA(pdaOf(getActiveDoc())!, w).accepted);
    // a janela Propriedades chama assim quando o usuário digita X e deixa "Trocar Z por X nas regras também" marcado
    useDocuments.getState().setPDAOptions({ startStackSymbol: 'X' }, { renameInRules: true });
    const after = words01.map((w) => simulatePDA(pdaOf(getActiveDoc())!, w).accepted);
    // obtido: o Z some dentro do X; ε, 0, 00 e 001 passam a ser aceitas (deixou de ser 0ⁿ1ⁿ)
    expect(after).toEqual(before);
  });

  it('MT: trocar o branco por um símbolo que JÁ está em Γ (caixa marcada) não pode mudar a linguagem sem aviso', () => {
    const ex = TM_EXAMPLES.find((e) => e.id === 'mt-0n1n')!; // Exemplo 8.2: Γ = {0, 1, X, Y, B}
    useDocuments.getState().loadFile(fileOf(ex.name, { kind: 'tm', tm: ex.tm }, ex.layout), { template: true });
    const before = words01.map((w) => simulateTM(tmOf(getActiveDoc())!, w).accepted);
    useDocuments.getState().setTMOptions({ blank: 'Y' }, { renameInRules: true });
    const after = words01.map((w) => simulateTM(tmOf(getActiveDoc())!, w).accepted);
    // obtido: B e Y viram um símbolo só; a fita vazia agora é "YYY…" e ε passa a ser aceita
    expect(after).toEqual(before);
  });
});
