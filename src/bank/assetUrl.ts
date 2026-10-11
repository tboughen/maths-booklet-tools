export function resolveBankAssetUrl(path: string, siteBase: string, bankOrigin = ""): string {
  const relative = path.replace(/^\//, "");
  if (bankOrigin && relative.startsWith("bank/assets/")) return `${bankOrigin.replace(/\/$/, "")}/${relative}`;
  return `${siteBase}${relative}`;
}
