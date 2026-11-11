import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

export const PIECE_HASH = 0x1011; // fr32-sha256-trunc254-padbintree, Filecoin piece CID v2
export type CidRef = { cid: CID; path: string; key: string; piece?: string };

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

// A piece's bytes live at <host>/public/<piece>; /piece/ redirects, which the host cannot follow.
function pieceUrl(text: string, piece: string): string | undefined {
  const m = text.match(new RegExp(`https://[^\\s/]+/(?:piece|public)/${piece}`));
  return m?.[0].replace('/piece/', '/public/');
}

export function findCids(text: string): CidRef[] {
  const out = new Map<string, CidRef>();
  for (const m of text.matchAll(RE)) {
    const cid = parseCid(m[1] ?? m[3] ?? m[5] ?? '');
    if (!cid) continue;
    const code = cid.multihash.code;
    if (code !== sha256.code && code !== PIECE_HASH) continue; // only what we can verify or locate
    const path = (m[2] ?? m[4] ?? '').replace(/[.,;:!?]+$/, '').replace(/\/+$/, '');
    const key = cid.toString() + path;
    if (out.has(key)) continue;
    out.set(key, code === PIECE_HASH ? { cid, path: '', key, piece: pieceUrl(text, key) ?? '' } : { cid, path, key });
  }
  return [...out.values()];
}

export function isIpfsUrl(url: string): boolean {
  return /^ipfs:\/\/|^https?:\/\/([^/]+\/ipfs\/|[a-z2-7]{59,}\.ipfs\.)/.test(url) && findCids(url).length > 0;
}
