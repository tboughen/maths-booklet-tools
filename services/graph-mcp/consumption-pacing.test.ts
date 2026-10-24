import { describe, it, expect } from 'vitest';
import { consumptionPacer } from './consumption-pacing';

describe('original production-quota pacing', () => {
  it('waits before request 32 and accounts for work elapsed', async () => {
    let time = 0;
    const waits: number[] = [];
    const p = consumptionPacer({ now: () => time, wait: async ms => { waits.push(ms); time += ms; } });
    for (let i = 0; i < 31; i++) { await p.beforeRequest(); time += 100; }
    expect(waits).toEqual([]);
    await p.beforeRequest();
    expect(waits).toEqual([57_900]);
    expect(p.metrics).toEqual({ requests: 32, windowWaits: 1, waitMs: 57_900 });
    for (let i = 0; i < 31; i++) await p.beforeRequest();
    expect(waits).toEqual([57_900, 61_000]);
  });
  it('adds no minute when work already consumed the window', async () => {
    let time = 0;
    const waits: number[] = [];
    const p = consumptionPacer({ now: () => time, wait: async ms => { waits.push(ms); } });
    for (let i = 0; i < 31; i++) await p.beforeRequest();
    time = 70_000;
    await p.beforeRequest();
    expect(waits).toEqual([0]);
    expect(p.metrics.waitMs).toBe(0);
  });
});
