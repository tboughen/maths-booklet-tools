"""Read advances from the bundled OpenType fonts; no external package needed."""
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-.\u2212\u00d7\u00f7'

def advances(filename):
    data = (root / 'assets/graph-fonts' / filename).read_bytes()
    u16 = lambda offset: struct.unpack_from('>H', data, offset)[0]
    u32 = lambda offset: struct.unpack_from('>I', data, offset)[0]
    tables = {}
    for index in range(u16(4)):
        at = 12 + index * 16
        tables[data[at:at+4].decode()] = u32(at+8)
    cmap = tables['cmap']
    candidates = [cmap + u32(cmap+4+i*8+4) for i in range(u16(cmap+2))]
    sub = next(offset for offset in candidates if u16(offset) == 4)
    count = u16(sub+6)//2
    end = sub+14
    start = end+count*2+2
    delta = start+count*2
    ranges = delta+count*2
    def glyph(code):
        for index in range(count):
            if u16(start+index*2) <= code <= u16(end+index*2):
                shift = u16(delta+index*2)
                step = u16(ranges+index*2)
                if not step:
                    return (code+shift) & 65535
                result = u16(ranges+index*2+step+2*(code-u16(start+index*2)))
                return (result+shift) & 65535 if result else 0
        return 0
    units = u16(tables['head']+18)
    metrics_count = u16(tables['hhea']+34)
    result = {}
    for character in characters:
        index = glyph(ord(character))
        if index == 0:
            raise ValueError('Missing glyph ' + repr(character))
        result[character] = u16(tables['hmtx']+min(index, metrics_count-1)*4)/units
    return result

regular = advances('STIXTwoText-Regular.otf')
italic = advances('STIXTwoText-Italic.otf')
output = '// Generated from bundled STIX Two Text hmtx/cmap; regenerate with scripts/ratio-font-metrics.py.\n'
output += 'const regular: Record<string, number> = ' + json.dumps(regular, ensure_ascii=True, sort_keys=True) + ';\n'
output += 'const italic: Record<string, number> = ' + json.dumps(italic, ensure_ascii=True, sort_keys=True) + ';\n'
output += 'export function glyphAdvance(character: string, useItalic = false): number {\n  return (useItalic ? italic : regular)[character] ?? 1;\n}\n'
(root / 'packages/ratio-table-core/src/font-metrics.ts').write_text(output, encoding='utf-8')
