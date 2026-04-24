import { describe, it, expect } from 'vitest';
import { parseCSV } from '../store/js/csv';

describe('parseCSV', () => {
  it('parses a simple file', () => {
    const text = 'name,score\nAda,95\nBob,40\n';
    expect(parseCSV(text)).toEqual([
      { name: 'Ada', score: 95 },
      { name: 'Bob', score: 40 },
    ]);
  });

  it('handles quoted fields with embedded commas and double-quotes', () => {
    const text = 'name,note\n"Ada, Ada","says ""hi"""\n';
    expect(parseCSV(text)).toEqual([{ name: 'Ada, Ada', note: 'says "hi"' }]);
  });

  it('accepts CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4\r\n';
    expect(parseCSV(text)).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });

  it('coerces booleans and numbers but preserves leading-zero IDs', () => {
    const text = 'id,ok,age\n007,true,35\n';
    expect(parseCSV(text)).toEqual([{ id: '007', ok: true, age: 35 }]);
  });

  it('empties become null', () => {
    const text = 'a,b,c\n,,x\n';
    expect(parseCSV(text)).toEqual([{ a: null, b: null, c: 'x' }]);
  });
});
