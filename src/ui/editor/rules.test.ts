import { describe, expect, it } from 'vitest';
import { EPSILON } from '../../core/fa/types';
import type { PDARule } from '../../core/pda/types';
import type { TMRule } from '../../core/tm/types';
import {
  formatPDARule,
  formatTMRule,
  lineText,
  MAX_RULE_LINES,
  parseMove,
  parsePDAFields,
  parsePDAText,
  parseTMFields,
  parseTMText,
  pdaRuleParts,
  ruleLabel,
  tmRuleParts,
} from './rules';

const pr = (read: string, pop: string, push: string): PDARule => ({ read, pop, push });
const tr = (read: string, write: string, move: 'L' | 'R'): TMRule => ({ read, write, move });

describe('notação do Hopcroft', () => {
  it('AP: "a, X/γ" com ε na entrada e em γ vazio', () => {
    expect(formatPDARule(pr('0', 'Z', '0Z'))).toBe('0, Z/0Z');
    expect(formatPDARule(pr(EPSILON, 'Z', 'Z'))).toBe('ε, Z/Z');
    expect(formatPDARule(pr('1', '0', ''))).toBe('1, 0/ε');
  });

  it('MT: "X/Y →" e "X/Y ←"', () => {
    expect(formatTMRule(tr('0', 'X', 'R'))).toBe('0/X →');
    expect(formatTMRule(tr('Y', 'Y', 'L'))).toBe('Y/Y ←');
  });

  it('partes do rótulo marcam ε e a seta', () => {
    const parts = pdaRuleParts(pr(EPSILON, 'Z', ''));
    expect(lineText(parts)).toBe('ε, Z/ε');
    expect(parts.filter((p) => p.tone === 'eps').map((p) => p.text)).toEqual([EPSILON, EPSILON]);
    expect(tmRuleParts(tr('0', 'X', 'R')).find((p) => p.tone === 'move')?.text).toBe('→');
  });

  it('rótulo com muitas regras fica compacto, com todas na dica', () => {
    const few = ruleLabel([pr('0', 'Z', '0Z'), pr('1', 'Z', '1Z')], pdaRuleParts);
    expect(few.compact).toBe(false);
    expect(few.text).toBe('0, Z/0Z\n1, Z/1Z');
    const rules = Array.from({ length: MAX_RULE_LINES + 3 }, (_, i) => tr(String(i), 'X', 'R'));
    const many = ruleLabel(rules, tmRuleParts);
    expect(many.compact).toBe(true);
    expect(many.lines).toHaveLength(MAX_RULE_LINES);
    expect(lineText(many.lines[MAX_RULE_LINES - 1]!)).toBe('… +4');
    expect(many.ruleOf[MAX_RULE_LINES - 1]).toBeNull();
    expect(many.full.split('\n')).toHaveLength(rules.length);
  });
});

describe('campos da regra do AP', () => {
  it('lê os três campos; vazio ou ε em a e γ é ε', () => {
    expect(parsePDAFields('0', 'Z', '0Z').rule).toEqual(pr('0', 'Z', '0Z'));
    expect(parsePDAFields('', 'Z', '').rule).toEqual(pr(EPSILON, 'Z', ''));
    expect(parsePDAFields('ε', ' Z ', 'ε').rule).toEqual(pr(EPSILON, 'Z', ''));
    expect(parsePDAFields('ϵ', 'Z', '0 Z').rule).toEqual(pr(EPSILON, 'Z', '0Z'));
  });

  it('linha toda vazia é ignorada (sem erro)', () => {
    expect(parsePDAFields(' ', '', '')).toEqual({ rule: null, errors: [] });
  });

  it('erros em português simples, com o campo', () => {
    expect(parsePDAFields('0', '', '0').errors).toEqual([
      { field: 'pop', message: 'o topo da pilha (X) precisa ser exatamente 1 símbolo' },
    ]);
    expect(parsePDAFields('0', 'ZZ', '0').errors[0]!.message).toBe('o topo da pilha (X) precisa ser exatamente 1 símbolo');
    expect(parsePDAFields('0', 'Z0', '0').errors[0]!.message).toMatch(/o Z0 do livro aqui é só Z/);
    expect(parsePDAFields('0', 'ε', '0').errors[0]!.message).toMatch(/não pode ser ε/);
    expect(parsePDAFields('01', 'Z', 'Z').errors[0]).toEqual({ field: 'read', message: 'a entrada (a) precisa ser 1 símbolo ou ε' });
    expect(parsePDAFields('0', 'Z', '0ε').errors[0]!.field).toBe('push');
  });
});

describe('várias regras do AP de uma vez', () => {
  it('uma por linha, com ou sem espaços; linhas vazias não contam', () => {
    const { rules, errors } = parsePDAText('0, Z / 0Z\n\n0,0/00\n1, 0/ε\n  ε, Z/Z  ');
    expect(errors).toEqual([]);
    expect(rules).toEqual([pr('0', 'Z', '0Z'), pr('0', '0', '00'), pr('1', '0', ''), pr(EPSILON, 'Z', 'Z')]);
  });

  it('erros dizem a linha', () => {
    const { rules, errors } = parsePDAText('0, Z/0Z\n0 Z 0Z\n1, ZZ/ε');
    expect(rules).toEqual([pr('0', 'Z', '0Z')]);
    expect(errors).toEqual([
      { line: 2, message: 'use o formato a, X/γ (ex.: 0, Z/0Z)' },
      { line: 3, message: 'o topo da pilha (X) precisa ser exatamente 1 símbolo' },
    ]);
  });
});

describe('regras da MT', () => {
  it('campos: X e Y com 1 símbolo, sem ε', () => {
    expect(parseTMFields('0', 'X', 'R').rule).toEqual(tr('0', 'X', 'R'));
    expect(parseTMFields('', '', 'L')).toEqual({ rule: null, errors: [] });
    expect(parseTMFields('0', '', 'R').errors).toEqual([
      { field: 'write', message: 'o símbolo escrito (Y) precisa ser exatamente 1 símbolo' },
    ]);
    expect(parseTMFields('ε', 'B', 'R').errors[0]!.message).toMatch(/branco/);
    expect(parseTMFields('00', 'X', 'R').errors[0]!.field).toBe('read');
  });

  it('direções: R, L, setas, > <, D (direita) e E (esquerda)', () => {
    expect(['R', 'r', '→', '>', 'D'].map(parseMove)).toEqual(['R', 'R', 'R', 'R', 'R']);
    expect(['L', 'l', '←', '<', 'E'].map(parseMove)).toEqual(['L', 'L', 'L', 'L', 'L']);
    expect(parseMove('S')).toBeNull();
  });

  it('texto: "0/X R", "0/X →" e "0 / X, R"', () => {
    const { rules, errors } = parseTMText('0/X R\nY/Y →\n1 / Y, L\nB/B←');
    expect(errors).toEqual([]);
    expect(rules).toEqual([tr('0', 'X', 'R'), tr('Y', 'Y', 'R'), tr('1', 'Y', 'L'), tr('B', 'B', 'L')]);
  });

  it('texto com erro diz a linha', () => {
    const { rules, errors } = parseTMText('0/X R\n0 X R\n0/X S\n00/X R');
    expect(rules).toEqual([tr('0', 'X', 'R')]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(errors[1]!.message).toBe('a direção precisa ser → (R) ou ← (L)');
  });
});
