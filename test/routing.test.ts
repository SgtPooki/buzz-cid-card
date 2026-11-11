import { describe, expect, it } from 'vitest';
import { findProviders, httpsBase, parseProviders } from '../src/routing.js';
import { CID } from 'multiformats/cid';

describe('httpsBase', () => {
  it.each([
    ['/dns/a-fil-http.aur.lu/tcp/443/https', 'https://a-fil-http.aur.lu'],
    ['/dns4/gateway.octopin.app/tcp/443/https', 'https://gateway.octopin.app'],
    ['/ip4/109.150.215.145/tcp/8443/https', 'https://109.150.215.145:8443'],
    ['/dns4/node.example/tcp/4001/tls/http', 'https://node.example:4001'],
    ['/ip4/1.2.3.4/tcp/443/tls/sni/1-2-3-4.k51abc.libp2p.direct/http', 'https://1-2-3-4.k51abc.libp2p.direct'],
    ['/ip6/2001:db8::1/tcp/443/https', 'https://[2001:db8::1]'],
    ['/ip4/1.2.3.4/tcp/4001/tls/sni/1-2-3-4.k51abc.libp2p.direct/ws', null],
    ['/ip4/1.2.3.4/tcp/4001', null],
    ['/ip4/1.2.3.4/udp/4001/quic-v1', null],
    ['/dns/x/tcp/443/http', null],
  ])('%s -> %s', (addr, base) => {
    expect(httpsBase(addr)).toBe(base);
  });
});

describe('parseProviders', () => {
  it('puts gateway-protocol providers first and drops non-HTTPS addrs', () => {
    const json = JSON.stringify({ Providers: [
      { Addrs: ['/ip4/1.2.3.4/tcp/4001', '/dns/plain.example/tcp/443/https'] },
      { Addrs: ['/dns/gw.example/tcp/443/https', '/dns/gw.example/tcp/443/https'], Protocols: ['transport-ipfs-gateway-http'] },
      { Addrs: ['/ip4/5.6.7.8/udp/4001/quic-v1'], Protocols: ['transport-bitswap'] },
    ] });
    expect(parseProviders(json)).toEqual(['https://gw.example', 'https://plain.example']);
  });
});

describe('findProviders', () => {
  const cid = CID.parse('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
  it('falls back to the second router when the first fails or is empty', async () => {
    const calls: string[] = [];
    const request = async ({ url }: { url: string }) => {
      calls.push(url);
      if (url.startsWith('https://a')) return { status: 200, body: '{"Providers":[]}' };
      return { status: 200, body: '{"Providers":[{"Addrs":["/dns/gw.example/tcp/443/https"]}]}' };
    };
    expect(await findProviders(request, cid, ['https://a', 'https://b'])).toEqual(['https://gw.example']);
    expect(calls).toEqual([`https://a/routing/v1/providers/${cid}`, `https://b/routing/v1/providers/${cid}`]);
  });
  it('returns nothing when every router fails', async () => {
    const request = async () => { throw new Error('down'); };
    expect(await findProviders(request, cid, ['https://a'])).toEqual([]);
  });
});
