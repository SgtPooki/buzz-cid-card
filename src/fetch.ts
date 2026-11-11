import { CarReader } from '@ipld/car';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { equals } from 'multiformats/bytes';

export const GATEWAYS = ['https://trustless-gateway.link', 'https://ipfs.io', 'https://dweb.link'];
export const MAX_BYTES = 16 * 1024 * 1024;

export type RequestBytes = (input: { url: string; maxBytes: number; timeoutMs?: number }) => Promise<{ status: number; body: Uint8Array }>;
export type Blocks = Map<string, Uint8Array>;

// Sequential fallback, not a race: a race would download the same bytes from every gateway.
export async function fetchFirst(request: RequestBytes, path: string, maxBytes: number, gateways = GATEWAYS) {
  let error: unknown = new Error('no gateways');
  for (const gateway of gateways) {
    try {
      const res = await request({ url: gateway + path, maxBytes, timeoutMs: 20000 });
      if (res.status === 200) return { bytes: res.body, gateway };
      error = new Error(`${gateway}: HTTP ${res.status}`);
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

export async function verifyBlock(cid: CID, bytes: Uint8Array): Promise<void> {
  if (cid.multihash.code !== sha256.code) throw new Error('unsupported hash, cannot verify');
  const digest = await sha256.digest(bytes);
  if (!equals(digest.bytes, cid.multihash.bytes)) throw new Error('hash mismatch');
}

// Every block is hashed before it is kept; the root must be present.
export async function readCar(car: Uint8Array, root: CID): Promise<Blocks> {
  const reader = await CarReader.fromBytes(car);
  const blocks: Blocks = new Map();
  for await (const { cid, bytes } of reader.blocks()) {
    await verifyBlock(cid, bytes);
    blocks.set(cid.toString(), bytes);
  }
  if (!blocks.has(root.toString())) throw new Error('root block missing');
  return blocks;
}

export async function fetchCar(request: RequestBytes, root: CID, path: string, scope: 'block' | 'entity', maxBytes: number, gateways = GATEWAYS) {
  const { bytes, gateway } = await fetchFirst(request, `/ipfs/${root}${path}?format=car&dag-scope=${scope}`, maxBytes, gateways);
  return { blocks: await readCar(bytes, root), gateway };
}

const cars = new Map<string, Promise<Blocks>>();
// One CAR at a URL (a Filecoin piece) holds every block for its root; fetched once, every block verified.
export function fetchCarUrl(request: RequestBytes, url: string, root: CID): Promise<Blocks> {
  let p = cars.get(url);
  if (!p) {
    p = request({ url, maxBytes: MAX_BYTES, timeoutMs: 30000 }).then((res) => {
      if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
      return readCar(res.body, root);
    });
    p.catch(() => cars.delete(url));
    cars.set(url, p);
  }
  return p;
}
