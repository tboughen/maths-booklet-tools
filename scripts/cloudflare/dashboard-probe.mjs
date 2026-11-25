// When a Worker was last changed in the dashboard, wrangler deploy first reads its dashboard
// configuration and, if any read fails, stops with one generic message. This repeats those reads
// and prints each status and Cloudflare error code, so the missing token permission is named.
export async function probeDashboardReads(name, { token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID, fetcher = fetch } = {}) {
  if (!token || !account) return [];
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
  const get = async path => {
    try {
      const response = await fetcher(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => ({}));
      return { path, status: response.status, errors: (body.errors ?? []).map(e => `${e.code} ${String(e.message ?? '').split(account).join('<account>')}`), result: body.result };
    } catch (error) { return { path, status: 0, errors: [String(error.message).split(account).join('<account>')] }; }
  };
  const service = await get(`/workers/services/${name}`);
  const environment = service.result?.default_environment?.environment ?? 'production';
  const reads = await Promise.all([
    `/workers/services/${name}/environments/${environment}/bindings`,
    `/workers/services/${name}/environments/${environment}/routes?show_zonename=true`,
    `/workers/domains/records?page=0&per_page=5&service=${name}&environment=${environment}`,
    `/workers/services/${name}/environments/${environment}/subdomain`,
    `/workers/services/${name}/environments/${environment}`,
    `/workers/scripts/${name}/schedules`,
  ].map(get));
  const report = [service, ...reads].map(({ path, status, errors }) => ({ path, status, errors, lastDeployedFrom: path === `/workers/services/${name}` ? service.result?.default_environment?.script?.last_deployed_from : undefined }));
  for (const line of report) console.log(`Dashboard read ${line.status} ${line.path}${line.errors.length ? ` ${line.errors.join('; ')}` : ''}${line.lastDeployedFrom ? ` (last deployed from ${line.lastDeployedFrom})` : ''}`);
  return report;
}
