import { FA_EXAMPLES } from '../../core/fa/examples';
import { countWords, formatBatch, generateWords, parseBatch, runBatch, summarize } from './batch';

describe('parseBatch', () => {
  it('uma palavra por linha, ignora linhas em branco e espaços', () => {
    expect(parseBatch('01\n\n  10 \n1 1')).toEqual([
      { line: 1, word: '01', expected: null },
      { line: 3, word: '10', expected: null },
      { line: 4, word: '11', expected: null },
    ]);
  });

  it('prefixos + e - indicam o esperado', () => {
    expect(parseBatch('+01\n-10\n+ 11')).toEqual([
      { line: 1, word: '01', expected: true },
      { line: 2, word: '10', expected: false },
      { line: 3, word: '11', expected: true },
    ]);
  });

  it('ε, prefixo sozinho e ε no meio', () => {
    expect(parseBatch('ε\n+\n-ε\n0ε1').map((e) => [e.word, e.expected])).toEqual([
      ['', null],
      ['', true],
      ['', false],
      ['01', null],
    ]);
  });

  it('quando + ou - está em Σ, só vale como esperado se vier separado por espaço', () => {
    const sigma = ['+', '-', '.', '1'];
    expect(parseBatch('+1.\n- -1.\n-.1', sigma)).toEqual([
      { line: 1, word: '+1.', expected: null },
      { line: 2, word: '-1.', expected: false },
      { line: 3, word: '-.1', expected: null },
    ]);
    // sem Σ com +, o prefixo vale normalmente
    expect(parseBatch('+1.')[0]).toEqual({ line: 1, word: '1.', expected: true });
  });

  it('formatBatch é o inverso', () => {
    const entries = parseBatch('+01\n-ε\n10');
    expect(formatBatch(entries)).toBe('+01\n-ε\n10');
  });
});

describe('generateWords', () => {
  it('ordem por tamanho e depois alfabética, começando por ε', () => {
    expect(generateWords(['1', '0'], 2)).toEqual({ words: ['', '0', '1', '00', '01', '10', '11'], truncated: false });
  });

  it('tamanho 0 e Σ vazio', () => {
    expect(generateWords(['a'], 0).words).toEqual(['']);
    expect(generateWords([], 3).words).toEqual(['']);
  });

  it('para no limite', () => {
    const g = generateWords(['0', '1'], 10, 5);
    expect(g.words).toEqual(['', '0', '1', '00', '01']);
    expect(g.truncated).toBe(true);
  });

  it('countWords', () => {
    expect(countWords(2, 2)).toBe(7);
    expect(countWords(1, 4)).toBe(5);
    expect(countWords(3, 0)).toBe(1);
  });
});

describe('runBatch + summarize', () => {
  it('confere com o esperado', () => {
    const fa = FA_EXAMPLES.find((e) => e.id === 'afd-so-01')!.fa;
    const results = runBatch(fa, parseBatch('+01\n-01\n00\n+ε'));
    expect(results.map((r) => [r.accepted, r.ok])).toEqual([
      [true, true],
      [true, false],
      [false, null],
      [false, false],
    ]);
    expect(summarize(results)).toEqual({ total: 4, accepted: 2, rejected: 2, passed: 1, failed: 2 });
  });
});
