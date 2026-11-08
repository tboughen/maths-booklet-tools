export const contentSecurityPolicy: string;
export const securityHeaders: Record<string, string>;
export const siteHeaders: string;
export const robotsTxt: string;
export function parseHeaders(text: string): { pattern: string; headers: Record<string, string> }[];
export function headersFor(rules: { pattern: string; headers: Record<string, string> }[], pathname: string): Record<string, string>;
