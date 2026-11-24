import { describe, expect, it } from 'vitest';
import type { PDAFile, TMFile } from '../core/automaton';
import type { AutomatonFile } from '../core/fa/types';
import {
  automatonOf,
  baseName,
  fileNameFor,
  FileFormatError,
  fileOf,
  parseAutomatonFile,
  serializeAutomatonFile,
} from './fileFormat';

const valid: AutomatonFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'fa',
  name: 'termina em 01',
  fa: {
    states: [
      { id: 'q0', name: 'q0', initial: true, final: false },
      { id: 'q1', name: 'q1', initial: false, final: true },
    ],
    transitions: [{ id: 't0', from: 'q0', to: 'q1', symbols: ['0', 'ε'] }],
  },
  layout: { positions: { q0: { x: 0, y: 0 }, q1: { x: 160, y: 0 } }, edges: { t0: { curvature: 0.2 } } },
};

describe('parseAutomatonFile', () => {
  it('lê o que foi escrito (ida e volta)', () => {
    expect(parseAutomatonFile(serializeAutomatonFile(valid))).toEqual(valid);
  });

  it('recusa JSON quebrado com mensagem amigável', () => {
    expect(() => parseAutomatonFile('{ nada')).toThrow(FileFormatError);
    expect(() => parseAutomatonFile('{ nada')).toThrow(/JSON válido/);
  });

  it('confere format, version e kind', () => {
    expect(() => parseAutomatonFile(JSON.stringify({ ...valid, format: 'jflap' }))).toThrow(/não é do Automata Studio/);
    expect(() => parseAutomatonFile(JSON.stringify({ ...valid, version: 2 }))).toThrow(/versão 2/);
    expect(() => parseAutomatonFile(JSON.stringify({ ...valid, kind: 'xyz' }))).toThrow(/tipo de autômato/);
    // AP sem os dados do AP: mensagem amigável, não um erro de programa
    expect(() => parseAutomatonFile(JSON.stringify({ ...valid, kind: 'pda' }))).toThrow(/autômato com pilha/);
    expect(() => parseAutomatonFile(JSON.stringify({ ...valid, kind: 'tm' }))).toThrow(/máquina de Turing/);
  });

  it('recusa transição para estado que não existe', () => {
    const bad = { ...valid, fa: { ...valid.fa, transitions: [{ id: 't', from: 'q0', to: 'zz', symbols: ['a'] }] } };
    expect(() => parseAutomatonFile(JSON.stringify(bad))).toThrow(/não existe/);
  });

  it('layout incompleto não é erro (as posições são completadas depois)', () => {
    const noLayout = { ...valid, layout: undefined };
    const out = parseAutomatonFile(JSON.stringify(noLayout));
    expect(out.layout).toEqual({ positions: {}, edges: {} });
  });

  it('usa o nome do arquivo quando o JSON não tem nome', () => {
    const out = parseAutomatonFile(JSON.stringify({ ...valid, name: '' }), 'meu');
    expect(out.name).toBe('meu');
  });
});

const pdaFile: PDAFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'pda',
  name: '0n1n',
  pda: {
    states: [
      { id: 'q0', name: 'q0', initial: true, final: false },
      { id: 'q1', name: 'q1', initial: false, final: true },
    ],
    transitions: [
      {
        id: 't0',
        from: 'q0',
        to: 'q0',
        rules: [
          { read: '0', pop: 'Z', push: '0Z' },
          { read: '0', pop: '0', push: '00' },
          { read: '1', pop: '0', push: '' },
        ],
      },
      { id: 't1', from: 'q0', to: 'q1', rules: [{ read: 'ε', pop: 'Z', push: 'Z' }] },
    ],
    startStackSymbol: 'Z',
    acceptance: 'EMPTY_STACK',
  },
  layout: { positions: { q0: { x: 0, y: 0 }, q1: { x: 200, y: 0 } }, edges: { t0: { curvature: 0, loopAngle: 0 } } },
};

const tmFile: TMFile = {
  format: 'automatos-studio',
  version: 1,
  kind: 'tm',
  name: 'troca',
  tm: {
    states: [
      { id: 'q0', name: 'q0', initial: true, final: false },
      { id: 'q1', name: 'q1', initial: false, final: true },
    ],
    transitions: [
      { id: 't0', from: 'q0', to: 'q0', rules: [{ read: '0', write: '1', move: 'R' }] },
      { id: 't1', from: 'q0', to: 'q1', rules: [{ read: 'B', write: 'B', move: 'L' }] },
    ],
    blank: 'B',
    acceptance: 'HALT',
    inputAlphabet: ['0', '1'],
  },
  layout: { positions: { q0: { x: 0, y: 0 }, q1: { x: 200, y: 0 } }, edges: {} },
};

describe('parseAutomatonFile: AP e MT', () => {
  it('lê o que foi escrito (ida e volta) nos três tipos', () => {
    expect(parseAutomatonFile(serializeAutomatonFile(pdaFile))).toEqual(pdaFile);
    expect(parseAutomatonFile(serializeAutomatonFile(tmFile))).toEqual(tmFile);
  });

  it('arquivo ⇄ autômato', () => {
    const a = automatonOf(pdaFile);
    expect(a).toEqual({ kind: 'pda', pda: pdaFile.pda });
    expect(fileOf(pdaFile.name, a, pdaFile.layout)).toEqual(pdaFile);
    expect(fileOf('x', automatonOf(valid), valid.layout)).toEqual({ ...valid, name: 'x' });
    expect(fileOf('t', automatonOf(tmFile), tmFile.layout)).toEqual({ ...tmFile, name: 't' });
  });

  it('completa o que faltar com os padrões (Z0 = Z, branco B, por estado final, Σ não informado)', () => {
    const pda: Partial<PDAFile['pda']> = { ...pdaFile.pda };
    delete pda.startStackSymbol;
    delete pda.acceptance;
    const out = parseAutomatonFile(JSON.stringify({ ...pdaFile, pda }));
    expect(out.kind === 'pda' && out.pda.startStackSymbol).toBe('Z');
    expect(out.kind === 'pda' && out.pda.acceptance).toBe('FINAL_STATE');
    const tm: Partial<TMFile['tm']> = { ...tmFile.tm };
    delete tm.blank;
    delete tm.acceptance;
    delete tm.inputAlphabet;
    const outTm = parseAutomatonFile(JSON.stringify({ ...tmFile, tm }));
    expect(outTm.kind === 'tm' && outTm.tm.blank).toBe('B');
    expect(outTm.kind === 'tm' && outTm.tm.acceptance).toBe('FINAL_STATE');
    expect(outTm.kind === 'tm' && outTm.tm.inputAlphabet).toEqual([]);
  });

  it('tira regras repetidas e mantém a ordem', () => {
    const t0 = pdaFile.pda.transitions[0]!;
    const rules = [t0.rules[1]!, t0.rules[0]!, t0.rules[1]!];
    const out = parseAutomatonFile(
      JSON.stringify({ ...pdaFile, pda: { ...pdaFile.pda, transitions: [{ ...t0, rules }] } }),
    );
    expect(out.kind === 'pda' && out.pda.transitions[0]!.rules).toEqual([t0.rules[1], t0.rules[0]]);
  });

  it('AP ou MT quebrados dão mensagem amigável', () => {
    const badRule = { ...pdaFile, pda: { ...pdaFile.pda, transitions: [{ id: 't', from: 'q0', to: 'q1', rules: [{ read: '0' }] }] } };
    expect(() => parseAutomatonFile(JSON.stringify(badRule))).toThrow(FileFormatError);
    expect(() => parseAutomatonFile(JSON.stringify(badRule))).toThrow(/regra nº 1 da transição "t"/);
    const noRules = { ...pdaFile, pda: { ...pdaFile.pda, transitions: [{ id: 't', from: 'q0', to: 'q1', symbols: ['0'] }] } };
    expect(() => parseAutomatonFile(JSON.stringify(noRules))).toThrow(/lista de regras/);
    const badAcc = { ...pdaFile, pda: { ...pdaFile.pda, acceptance: 'PILHA' } };
    expect(() => parseAutomatonFile(JSON.stringify(badAcc))).toThrow(/modo de aceitação/);
    const dangling = { ...tmFile, tm: { ...tmFile.tm, transitions: [{ id: 't', from: 'q0', to: 'zz', rules: [] }] } };
    expect(() => parseAutomatonFile(JSON.stringify(dangling))).toThrow(/não existe/);
    const badMove = {
      ...tmFile,
      tm: { ...tmFile.tm, transitions: [{ id: 't', from: 'q0', to: 'q1', rules: [{ read: '0', write: '1', move: 'S' }] }] },
    };
    expect(() => parseAutomatonFile(JSON.stringify(badMove))).toThrow(/direção inválida/);
    const badSigma = { ...tmFile, tm: { ...tmFile.tm, inputAlphabet: 'abc' } };
    expect(() => parseAutomatonFile(JSON.stringify(badSigma))).toThrow(/alfabeto de entrada/);
    const badBlank = { ...tmFile, tm: { ...tmFile.tm, blank: 0 } };
    expect(() => parseAutomatonFile(JSON.stringify(badBlank))).toThrow(/branco/);
  });
});

describe('nomes de arquivo', () => {
  it('fileNameFor tira caracteres proibidos e põe a extensão', () => {
    expect(fileNameFor('a/b: c?')).toBe('ab c.automato.json');
    expect(fileNameFor('x.automato.json')).toBe('x.automato.json');
    expect(fileNameFor('   ')).toBe('automato.automato.json');
    expect(fileNameFor('img', '.png')).toBe('img.png');
  });
  it('baseName tira a extensão', () => {
    expect(baseName('termina em 01.automato.json')).toBe('termina em 01');
    expect(baseName('x.json')).toBe('x');
  });
});
