import { describe, expect, it, vi } from 'vitest';
import { fetchCarUrl, fetchFirst, readCar, verifyBlock } from '../src/fetch.js';
import { car, rawBlock } from './fixture.js';

describe('verifyBlock / readCar', () => {
  it('accepts matching bytes and rejects a tampered block', async () => {
    const good = await rawBlock(new TextEncoder().encode('hello'));
    await expect(verifyBlock(good.cid, good.bytes)).resolves.toBeUndefined();
    const tampered = new Uint8Array(good.bytes);
    tampered[0] ^= 1;
    await expect(readCar(await car([{ cid: good.cid, bytes: tampered }]), good.cid)).rejects.toThrow('hash mismatch');
  });
  it('rejects a CAR without the requested root', async () => {
    const a = await rawBlock(new Uint8Array([1]));
    const b = await rawBlock(new Uint8Array([2]));
    await expect(readCar(await car([a]), b.cid)).rejects.toThrow('root block missing');
  });
});

describe('fetchFirst', () => {
  it('falls back in declared order and stops at the first 200', async () => {
    const calls: string[] = [];
    const request = vi.fn(async ({ url }: { url: string }) => {
      calls.push(url);
      if (url.startsWith('https://a')) throw new Error('down');
      if (url.startsWith('https://b')) return { status: 504, body: new Uint8Array() };
      return { status: 200, body: new Uint8Array([7]) };
    });
    const res = await fetchFirst(request, '/ipfs/x', 10, ['https://a', 'https://b', 'https://c', 'https://d']);
    expect(res.gateway).toBe('https://c');
    expect(calls).toEqual(['https://a/ipfs/x', 'https://b/ipfs/x', 'https://c/ipfs/x']);
  });
  it('surfaces the last failure when every gateway fails', async () => {
    const request = async () => ({ status: 404, body: new Uint8Array() });
    await expect(fetchFirst(request, '/ipfs/x', 10, ['https://a', 'https://b'])).rejects.toThrow('https://b: HTTP 404');
  });
});

describe('fetchCarUrl', () => {
  it('loads verified blocks from a CAR at a URL once, and rejects a tampered CAR', async () => {
    const good = await rawBlock(new TextEncoder().encode('sealed'));
    const bytes = await car([good]);
    const request = vi.fn(async () => ({ status: 200, body: bytes }));
    const url = 'https://calib.ezpdpz.net/public/bafkzcibtest';
    const a = await fetchCarUrl(request, url, good.cid);
    const b = await fetchCarUrl(request, url, good.cid);
    expect(a).toBe(b);
    expect(request).toHaveBeenCalledTimes(1);
    expect(a.get(good.cid.toString())).toEqual(good.bytes);
    const bad = new Uint8Array(bytes);
    bad[bad.length - 1] ^= 1;
    await expect(fetchCarUrl(async () => ({ status: 200, body: bad }), url + '2', good.cid)).rejects.toThrow('hash mismatch');
  });
});
