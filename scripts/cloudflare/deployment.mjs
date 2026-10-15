import { randomUUID } from 'node:crypto';
import { save } from './common.mjs';
import { validateQualification } from './evidence.mjs';

// All mutations go through the injected adapter, making failure/recovery behavior
// exercisable without creating a real Cloudflare deployment.
export async function promoteRelease({ release, qualification, adapter, expectedVersion, journalPath, rollbackOnFailure = false }) {
  validateQualification(release, qualification);
  if (!expectedVersion) throw new Error('An explicit expected current Worker version is required');
  const record = { schemaVersion: 1, attemptId: randomUUID(), releaseId: release.releaseId, previousVersion: expectedVersion, status: 'preflight', startedAt: new Date().toISOString(), events: [] };
  const event = (status, details = {}) => { Object.assign(record, details, { status }); record.events.push({ status, at: new Date().toISOString(), ...details }); save(journalPath, record); };
  event('preflight');
  let deployedVersion;
  try {
    if (await adapter.current() !== expectedVersion) throw new Error('Production advanced after this candidate was prepared; publication stopped');
    await adapter.validate();
    const inventory = await adapter.inventory();
    event('assets-verified', { inventory });
    if (await adapter.current() !== expectedVersion) throw new Error('Another release advanced during asset verification; publication stopped');
    event('deploying');
    try { deployedVersion = await adapter.deploy(); }
    catch (error) {
      const observed = await adapter.current();
      if (observed === expectedVersion) throw error;
      // Lost responses cannot be equated with an accepted upload. Establish that
      // the actual served bytes are this release before attributing the version.
      await adapter.verifyBytes();
      deployedVersion = observed;
      event('deployment-reconciled', { deployedVersion });
    }
    if (!deployedVersion || deployedVersion === expectedVersion) throw new Error('Deployment did not establish a new Worker version');
    event('deployed', { deployedVersion });
    await adapter.verifyBytes();
    await adapter.smoke();
    if (await adapter.current() !== deployedVersion) throw new Error('Release was superseded during verification');
    event('live-verified', { completedAt: new Date().toISOString() });
    return record;
  } catch (error) {
    event(deployedVersion ? 'deployed-unverified' : 'failed', { error: error.message, completedAt: new Date().toISOString() });
    if (deployedVersion && rollbackOnFailure && adapter.confirmedApplicationFailure?.(error) && await adapter.current() === deployedVersion) {
      event('rolling-back');
      try {
        await adapter.rollback(expectedVersion);
        if (await adapter.current() !== expectedVersion) throw new Error('Previous Worker version was not restored');
        await adapter.verifyPrevious(expectedVersion);
        event('rolled-back', { restoredVersion: expectedVersion, completedAt: new Date().toISOString() });
      } catch (recovery) { event('recovery-unverified', { recoveryError: recovery.message }); }
    }
    throw new Error(`Release ${record.status}: ${error.message}`);
  }
}
