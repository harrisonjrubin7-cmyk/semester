import { describe, expect, it } from 'vitest';
import { boundaryNotice } from './safety';

describe('boundary notices', () => {
  it('names the boundary a topic runs into', () => {
    expect(boundaryNotice('what dose should I give my patient')?.boundary).toBe('clinical');
    expect(boundaryNotice('answers to the take-home exam')?.boundary).toBe('assessment');
    expect(boundaryNotice('should I buy this stock')?.boundary).toBe('finance');
  });

  it('stays quiet on ordinary coursework, including the letter phi', () => {
    expect(boundaryNotice('sleep and memory in first-year students')).toBeNull();
    expect(boundaryNotice('golden ratio phi in Fibonacci')).toBeNull();
    expect(boundaryNotice('supply and demand elasticity')).toBeNull();
  });
});
