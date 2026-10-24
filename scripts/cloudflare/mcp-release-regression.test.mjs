import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { guardedOverlay, stageDecision, recordStage, verifyCompatibility } from './mcp-release.mjs';
import { browserFixtureFiles, sealFixtures, verifyFixtures } from './mcp-evidence.mjs';
import { sha256, digestObject, fileManifest } from './common.mjs';

const temporary = [];
const temp = () => { const d=mkdtempSync(resolve(tmpdir(),'md-mcp-review-')); temporary.push(d); return d; };
afterEach(() => { for(const d of temporary.splice(0)) rmSync(d,{recursive:true,force:true}); });
const identity = {sourceTree:'tree',buildId:'build',producer:'producer',run:'run',attempt:'1'};
const manifests = {'plugin.json':'{"version":"1","app":"same"}', '.codex-plugin/plugin.json':'{"version":"1","app":"same"}'};

test('resume reopens saved verified evidence and rejects corruption or loss', () => {
  const path=resolve(temp(),'proof.json');writeFileSync(path,'proof');
  const record={scope:'publication',stages:{service:{status:'planned',observations:[]}}};
  const verified=recordStage(record,'service',{status:'verified',target:'new',observed:'new',provenance:'live-https',evidence:[{path,bytes:5,sha256:sha256('proof')}]});
  const observation={before:'old',target:'new',observed:'new'};
  assert.equal(stageDecision(verified,'service',observation),'reuse-verified');
  writeFileSync(path,'wrong');assert.throws(()=>stageDecision(verified,'service',observation),/evidence|differs/i);
  rmSync(path);assert.throws(()=>stageDecision(verified,'service',observation));
});

test('overlay rejects path aliases that bypass canonical manifest/conflict guards', () => {
  for(const path of ['./plugin.json','PLUGIN.JSON','skills//a/SKILL.md','skills/a/./SKILL.md','skills/a/SKILL.md/']) {
    assert.throws(()=>guardedOverlay(manifests,manifests,{[path]:'{"app":"wrong"}'}),/Unsafe|canonical/i);
  }
});

test('overlay preserves the actual app mapping file as well as plugin manifests', () => {
  const base={...manifests,'.app.json':'{"apps":{"current":{"id":"same"}}}'};
  assert.throws(()=>guardedOverlay(base,base,{'.app.json':'{"apps":{"different":{"id":"other"}}}'}),/binding|mapping/i);
  assert.throws(()=>guardedOverlay(base,{...base,'.app.json':'{"apps":{"different":{"id":"other"}}}'},{'guide.md':'new guidance'}),/mapping/i);
  assert.equal(guardedOverlay(base,base,{'.app.json':'{ "apps": {"current": {"id":"same"}}}'}).appBindingPreserved,true);
});

test('fixture identity requires producer, run and attempt before sealing', () => {
  const d=temp();for(const p of browserFixtureFiles)writeFileSync(resolve(d,p),'fixture');
  for(const key of ['sourceTree','buildId','producer','run','attempt']) {
    const missing={...identity};delete missing[key];
    assert.throws(()=>sealFixtures(d,missing,'browser'),/Incomplete fixture identity/);
  }
});

test('full fixture verification has its own mandatory proof inventory', () => {
  for(const proof of ['shading.json','svg-delivery-proof.json']) {
    const d=temp();for(const p of [...browserFixtureFiles,'shading.json','svg-delivery-proof.json'])writeFileSync(resolve(d,p),'fixture');
    sealFixtures(d,identity,'full');rmSync(resolve(d,proof));
    // Model a producer bug with a self-consistent manifest, not just bit rot.
    const manifest=JSON.parse(readFileSync(resolve(d,'fixture-manifest.json'))),files=fileManifest(d);delete files['fixture-manifest.json'];
    manifest.files=files;manifest.filesDigest=digestObject(files);writeFileSync(resolve(d,'fixture-manifest.json'),JSON.stringify(manifest));
    assert.throws(()=>verifyFixtures(d,identity,'full'),/Missing full/);
  }
});

test('legacy compatibility cannot be verified against an unrelated third release', () => {
  const d=temp();
  const rows=['current-current','current-new','new-current','new-new','saved-legacy'].map(pair=>{
    const websiteIdentity=pair.startsWith('new-')?'new-site':'old-site',serviceIdentity=pair.endsWith('-new')?'new-service':'old-service';
    const path=resolve(d,pair+'.json'),text=JSON.stringify({status:'passed',websiteIdentity,serviceIdentity,provenance:'synthetic regression receipt'});
    writeFileSync(path,text);return {pair,websiteIdentity,serviceIdentity,status:'verified',evidence:[{path,bytes:Buffer.byteLength(text),sha256:sha256(text)}]};
  });
  assert(verifyCompatibility(rows).compatibleForPublication);
  const last=rows.at(-1);last.websiteIdentity='unrelated-site';
  const text=JSON.stringify({status:'passed',websiteIdentity:last.websiteIdentity,serviceIdentity:last.serviceIdentity,provenance:'synthetic unrelated receipt'});
  writeFileSync(last.evidence[0].path,text);last.evidence[0].bytes=Buffer.byteLength(text);last.evidence[0].sha256=sha256(text);
  assert.throws(()=>verifyCompatibility(rows),/legacy|identit/i);
});

for(const mutation of ['changed','missing','digest']) test(`CLI rejects ${mutation} frozen material before a release decision`, () => {
  const root=temp(),put=(p,text)=>{mkdirSync(resolve(root,p,'..'),{recursive:true});writeFileSync(resolve(root,p),text);};
  cpSync(import.meta.dirname,resolve(root,'scripts/cloudflare'),{recursive:true});
  put('public/bank/catalogue.json','{}');put('.gitignore','cloudflare-release/\n');
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
  git(['init','-q']);git(['add','.']);git(['-c','user.name=Test fixture','-c','user.email=fixture@example.invalid','commit','-qm','Synthetic fixture']);
  const base=git(['rev-parse','HEAD']).trim(),dir=resolve(root,'cloudflare-release');
  const cli=(action,args)=>execFileSync(process.execPath,[resolve(root,'scripts/cloudflare/mcp-release.mjs'),action,...args],{cwd:root,encoding:'utf8',windowsHide:true,stdio:'pipe'});
  cli('plan',[`--base=${base}`,'--purpose=Regression','--scope=qualification',`--output=${dir}/record.json`]);
  put('cloudflare-release/material.json','original');put('cloudflare-release/paths.json','["cloudflare-release/material.json"]');
  cli('freeze',[`--record=${dir}/record.json`,`--paths=${dir}/paths.json`,`--output=${dir}/frozen.json`]);
  put('cloudflare-release/observation.json',JSON.stringify({stage:'qualification',status:'pending',before:'old',target:base,observed:'old'}));
  const args=[`--record=${dir}/frozen.json`,`--observation=${dir}/observation.json`];
  cli('decision',[...args,`--output=${dir}/control-decision.json`]);
  assert.equal(JSON.parse(readFileSync(resolve(dir,'control-decision.json'))).decision,'run-authorised-stage');
  cli('stage',[...args,`--output=${dir}/control-stage.json`]);
  assert.equal(JSON.parse(readFileSync(resolve(dir,'control-stage.json'))).stages.qualification.status,'pending');
  if(mutation==='changed')put('cloudflare-release/material.json','changed');
  if(mutation==='missing')rmSync(resolve(dir,'material.json'));
  if(mutation==='digest'){const r=JSON.parse(readFileSync(resolve(dir,'frozen.json')));r.evidenceDigest='wrong';put('cloudflare-release/frozen.json',JSON.stringify(r));}
  for(const action of ['decision','stage']) assert.throws(()=>cli(action,[...args,`--output=${dir}/${action}.json`]),/evidence|material|ENOENT|digest/i);
});
