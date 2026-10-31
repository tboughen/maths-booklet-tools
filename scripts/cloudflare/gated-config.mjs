import { accessSettings } from './site-worker.mjs';

// Refuse to deploy a website Worker that would serve the question bank without
// its R2 binding, its bank-only Worker route or a configured Access application.
export function assertGatedWorker(config) {
  const bucket = config.r2_buckets?.find(b => b.binding === 'BANK');
  if (config.main !== 'scripts/cloudflare/site-worker.mjs' || bucket?.bucket_name !== 'maths-booklet-assets'
      || JSON.stringify(config.assets?.run_worker_first) !== JSON.stringify(['/bank/assets/*'])
      || config.workers_dev !== false || config.preview_urls !== false) {
    throw new Error('Website Worker must serve the question bank only through the gated R2 route');
  }
  if (!accessSettings(config.vars || {})) throw new Error('Set ACCESS_TEAM_DOMAIN and ACCESS_AUD for the Cloudflare Access question-bank application before deploying');
}
