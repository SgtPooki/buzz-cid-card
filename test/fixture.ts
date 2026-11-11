import { CarWriter } from '@ipld/car';
import * as dagPb from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

export type Block = { cid: CID; bytes: Uint8Array };

export async function rawBlock(bytes: Uint8Array): Promise<Block> {
  return { cid: CID.createV1(raw.code, await sha256.digest(bytes)), bytes };
}

export async function pbBlock(node: dagPb.PBNode): Promise<Block> {
  const bytes = dagPb.encode(node);
  return { cid: CID.createV1(dagPb.code, await sha256.digest(bytes)), bytes };
}

// A UnixFS file split into raw leaves under one dag-pb root.
export async function fileBlocks(chunks: Uint8Array[]): Promise<Block[]> {
  const leaves = await Promise.all(chunks.map(rawBlock));
  const data = new UnixFS({ type: 'file', blockSizes: chunks.map((c) => BigInt(c.length)) });
  const root = await pbBlock({ Data: data.marshal(), Links: leaves.map((l) => ({ Hash: l.cid, Name: '', Tsize: l.bytes.length })) });
  return [root, ...leaves];
}

export async function dirBlocks(files: Record<string, Block[]>): Promise<Block[]> {
  const data = new UnixFS({ type: 'directory' });
  const links = Object.entries(files).map(([name, b]) => ({ Hash: b[0].cid, Name: name, Tsize: b.reduce((n, x) => n + x.bytes.length, 0) }));
  const root = await pbBlock({ Data: data.marshal(), Links: links });
  return [root, ...Object.values(files).flat()];
}

export async function car(blocks: Block[]): Promise<Uint8Array> {
  const { writer, out } = CarWriter.create([blocks[0].cid]);
  const parts: Uint8Array[] = [];
  const done = (async () => { for await (const p of out) parts.push(p); })();
  for (const b of blocks) await writer.put(b);
  await writer.close();
  await done;
  return concat(parts);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
