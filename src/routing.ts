import type { CID } from 'multiformats/cid';

export const ROUTERS = ['https://delegated-ipfs.dev', 'https://cid.contact'];
export type RequestText = (input: { url: string; headers?: Record<string, string>; timeoutMs?: number }) => Promise<{ status: number; body: string }>;

// /dns*/host/tcp/port/https | /tls/http | /tls/sni/name/http (libp2p.direct) → https base; anything else (ws, tcp only) → null
export function httpsBase(multiaddr: string): string | null {
  const p = multiaddr.split('/').slice(1);
  if (!/^(dns4?|dns6|ip4|ip6)$/.test(p[0] ?? '') || p[2] !== 'tcp') return null;
  let host = p[1];
  const port = p[3];
  const rest = p.slice(4).join('/');
  if (rest.startsWith('tls/sni/')) host = p[6];
  else if (rest !== 'https' && rest !== 'tls/http') return null;
  if (rest.startsWith('tls/sni/') && !rest.endsWith('/http')) return null;
  if (p[0] === 'ip6') host = `[${host}]`;
  return `https://${host}${port === '443' ? '' : `:${port}`}`;
}

type Provider = { Addrs?: string[]; Protocols?: string[] };

export function parseProviders(json: string): string[] {
  const providers: Provider[] = JSON.parse(json).Providers ?? [];
  const gateway = (p: Provider) => (p.Protocols ?? []).includes('transport-ipfs-gateway-http');
  const bases = [...providers.filter(gateway), ...providers.filter((p) => !gateway(p))]
    .flatMap((p) => (p.Addrs ?? []).map(httpsBase))
    .filter((b): b is string => b !== null);
  return [...new Set(bases)];
}

// First router with a non-empty answer wins; routers are declared origins.
export async function findProviders(request: RequestText, cid: CID, routers = ROUTERS): Promise<string[]> {
  for (const router of routers) {
    try {
      const res = await request({ url: `${router}/routing/v1/providers/${cid}`, headers: { accept: 'application/json' }, timeoutMs: 15000 });
      if (res.status !== 200) continue;
      const bases = parseProviders(res.body);
      if (bases.length) return bases.slice(0, 8);
    } catch {}
  }
  return [];
}
