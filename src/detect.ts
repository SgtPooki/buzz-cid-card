import { CID } from 'multiformats/cid';

export type CidRef = { cid: CID; path: string; key: string };

// ipfs://<cid>[/path] | http(s)://host/ipfs/<cid>[/path] | https://<cid>.ipfs.host[/path] | bare CID
const RE =
  /(?:ipfs:\/\/|https?:\/\/[^\s/]+\/ipfs\/)([A-Za-z0-9]+)(\/[^\s)>\]"']*)?|https?:\/\/([a-z2-7]{59,})\.ipfs\.[^\s/]+(\/[^\s)>\]"']*)?|(?<![A-Za-z0-9/])(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})(?![A-Za-z0-9])/g;

export function parseCid(text: string): CID | null {
  try {
    return CID.parse(text);
  } catch {
    return null;
  }
}

export function findCids(text: string): CidRef[] {
  const out = new Map<string, CidRef>();
  for (const m of text.matchAll(RE)) {
    const cid = parseCid(m[1] ?? m[3] ?? m[5] ?? '');
    if (!cid) continue;
    const path = (m[2] ?? m[4] ?? '').replace(/[.,;:!?]+$/, '').replace(/\/+$/, '');
    const key = cid.toString() + path;
    if (!out.has(key)) out.set(key, { cid, path, key });
  }
  return [...out.values()];
}

export function isIpfsUrl(url: string): boolean {
  return /^ipfs:\/\/|^https?:\/\/([^/]+\/ipfs\/|[a-z2-7]{59,}\.ipfs\.)/.test(url) && findCids(url).length > 0;
}
