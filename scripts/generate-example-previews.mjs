import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

mkdirSync('tmp/usability', { recursive:true });
await build({ entryPoints:['src/examples/galleryCatalogue.ts'], bundle:true, platform:'node', format:'cjs', outfile:'tmp/usability/catalogue.cjs' });
const catalogue = createRequire(import.meta.url)(resolve('tmp/usability/catalogue.cjs'));
const directory = resolve('src/assets/example-previews');
mkdirSync(directory, { recursive:true });
const report = process.env.USABILITY_OUTPUT ? resolve(process.env.USABILITY_OUTPUT) : resolve('tmp/usability/example-controls');
mkdirSync(report, { recursive:true });
const font = { fontFiles:['STIXTwoText-Regular.otf','STIXTwoText-Italic.otf','STIXTwoMath-Regular.otf'].map(name => resolve('assets/graph-fonts', name)), loadSystemFonts:false };
const hash = text => createHash('sha256').update(text).digest('hex');
const records = [];
for (const [group, examples] of Object.entries(catalogue)) {
  if (!Array.isArray(examples)) continue;
  for (const example of examples) {
    for (const worked of [false,true]) {
      if (worked && example.worked === false) continue;
      const resource = example.make(worked), json = JSON.stringify(resource);
      const svg = example.render(resource);
      const outlined = new Resvg(svg, { font }).toString();
      const name = `${example.id}-${worked ? 'worked' : 'scaffold'}`;
      writeFileSync(resolve(report, name + '.json'), json + '\n');
      writeFileSync(resolve(report, name + '.svg'), outlined);
      if (!worked) writeFileSync(resolve(directory, example.id + '.svg'), outlined);
      records.push({ group, id:example.id, worked, jsonHash:hash(json), svgHash:hash(outlined), sourceHref:example.sourceHref ?? null });
    }
  }
}
writeFileSync(resolve(report,'index.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({ examples:new Set(records.map(r=>r.id)).size, outputs:records.length, directory, report }));
