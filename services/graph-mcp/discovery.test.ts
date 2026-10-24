import { describe, it, expect } from 'vitest';
import { discoverTools } from './discovery';
const tool = (name: string) => ({ name, inputSchema: { type: 'object' as const } });
describe('bounded actual tool discovery', () => {
  it('follows cursors and retains full definitions', async () => {
    const seen: Array<string | undefined> = [];
    const tools = await discoverTools(async cursor => { seen.push(cursor); return cursor ? { tools: [tool('b')] } : { tools: [tool('a')], nextCursor: 'next' }; });
    expect(seen).toEqual([undefined, 'next']); expect(tools.map(t => t.name)).toEqual(['a', 'b']);
  });
  it('rejects cursor loops, duplicate names, empty and unbounded discovery', async () => {
    await expect(discoverTools(async () => ({ tools: [], nextCursor: 'same' }))).rejects.toThrow('cursor repeated');
    await expect(discoverTools(async () => ({ tools: [tool('same')], nextCursor: 'next' }))).rejects.toThrow('Duplicate');
    await expect(discoverTools(async () => ({ tools: [] }))).rejects.toThrow('Empty');
    let n = 0; await expect(discoverTools(async () => ({ tools: [tool(String(n++))], nextCursor: String(n) }), 2)).rejects.toThrow('bound exceeded');
  });
});
