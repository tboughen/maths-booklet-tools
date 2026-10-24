import type { ListToolsResult, Tool } from '@modelcontextprotocol/sdk/types.js';

/** Follow actual pagination, with bounded failure on duplicate names/cursors. */
export async function discoverTools(list: (cursor?: string) => Promise<ListToolsResult>, maxPages = 100): Promise<Tool[]> {
  const tools: Tool[] = [], cursors = new Set<string>(), names = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const response = await list(cursor);
    for (const tool of response.tools) {
      if (names.has(tool.name)) throw Error('Duplicate discovered tool name');
      names.add(tool.name); tools.push(tool);
    }
    cursor = response.nextCursor;
    if (!cursor) { if (!tools.length) throw Error('Empty discovery'); return tools; }
    if (cursors.has(cursor)) throw Error('Discovery cursor repeated');
    cursors.add(cursor);
  }
  throw Error('Discovery page bound exceeded');
}
