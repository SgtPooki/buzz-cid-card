import { exporter, type UnixFSEntry } from 'ipfs-unixfs-exporter';
import { CID } from 'multiformats/cid';
import type { Blocks } from './fetch.js';

export type Entry = { name: string; size: number };
export type Resolved =
  | { kind: 'file'; cid: CID; size: number }
  | { kind: 'directory'; cid: CID; size: number; entries: Entry[]; sharded: boolean }
  | { kind: 'object'; cid: CID; size: number };

function store(blocks: Blocks) {
  return {
    async get(cid: CID) {
      const b = blocks.get(cid.toString());
      if (!b) throw new Error(`block ${cid} not fetched`);
      return b;
    },
  };
}

export async function resolve(blocks: Blocks, root: CID, path: string): Promise<Resolved> {
  const entry = await exporter(`/ipfs/${root}${path}`, store(blocks));
  return describe(entry);
}

function describe(entry: UnixFSEntry): Resolved {
  const size = Number(entry.size);
  if (entry.type === 'directory') {
    const sharded = entry.unixfs.type === 'hamt-sharded-directory';
    const entries = sharded ? [] : entry.node.Links.map((l) => ({ name: l.Name ?? '', size: l.Tsize ?? 0 }));
    return { kind: 'directory', cid: entry.cid, size, entries, sharded };
  }
  if (entry.type === 'file' || entry.type === 'raw' || entry.type === 'identity') return { kind: 'file', cid: entry.cid, size };
  return { kind: 'object', cid: entry.cid, size };
}

export async function fileBytes(blocks: Blocks, root: CID, path: string): Promise<Uint8Array> {
  const entry = await exporter(`/ipfs/${root}${path}`, store(blocks));
  if (entry.type !== 'file' && entry.type !== 'raw' && entry.type !== 'identity') throw new Error('not a file');
  const out = new Uint8Array(Number(entry.size));
  let offset = 0;
  for await (const chunk of entry.content()) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export type Preview = { type: 'image'; mime: string } | { type: 'json' | 'text'; text: string } | { type: 'binary' };

export function sniff(bytes: Uint8Array): Preview {
  const mime = imageMime(bytes);
  if (mime) return { type: 'image', mime };
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0e-\x1f]/.test(text)) return { type: 'binary' };
    return asJson(text) ?? { type: 'text', text };
  } catch {
    return { type: 'binary' };
  }
}

function asJson(text: string): Preview | null {
  if (!/^\s*[[{]/.test(text)) return null;
  try {
    return { type: 'json', text: JSON.stringify(JSON.parse(text), null, 2) };
  } catch {
    return null;
  }
}

function imageMime(b: Uint8Array): string | null {
  const head = (n: number) => String.fromCharCode(...b.subarray(0, n));
  if (b[0] === 0x89 && head(4).slice(1) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (head(4) === 'GIF8') return 'image/gif';
  if (head(4) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
