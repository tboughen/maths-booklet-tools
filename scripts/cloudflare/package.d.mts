import type { ReleaseManifest } from './release.ts';
export function verifyReusableCatalogue(root: string, cache: string): { catalogueJson: string; manifest: ReleaseManifest };
