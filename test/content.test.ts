import { describe, expect, it } from 'vitest';
import { readCar } from '../src/fetch.js';
import { fileBytes, resolve, sniff } from '../src/content.js';
import { car, concat, dirBlocks, fileBlocks } from './fixture.js';

const chunks = [new TextEncoder().encode('chunk one '), new TextEncoder().encode('chunk two '), new TextEncoder().encode('chunk three')];

describe('unixfs', () => {
  it('assembles a chunked file from a verified CAR', async () => {
    const blocks = await fileBlocks(chunks);
    const store = await readCar(await car(blocks), blocks[0].cid);
    expect(await resolve(store, blocks[0].cid, '')).toMatchObject({ kind: 'file', size: 31 });
    expect(new TextDecoder().decode(await fileBytes(store, blocks[0].cid, ''))).toBe('chunk one chunk two chunk three');
  });
  it('walks a path and lists a directory with sizes', async () => {
    const file = await fileBlocks(chunks);
    const blocks = await dirBlocks({ 'readme.txt': file });
    const store = await readCar(await car(blocks), blocks[0].cid);
    expect(await resolve(store, blocks[0].cid, '')).toMatchObject({ kind: 'directory', entries: [{ name: 'readme.txt', size: concat(file.map((b) => b.bytes)).length }] });
    expect(await resolve(store, blocks[0].cid, '/readme.txt')).toMatchObject({ kind: 'file', cid: file[0].cid, size: 31 });
  });
  it('fails on a missing block instead of guessing', async () => {
    const blocks = await fileBlocks(chunks);
    const store = await readCar(await car(blocks.slice(0, 2)), blocks[0].cid);
    await expect(fileBytes(store, blocks[0].cid, '')).rejects.toThrow('not fetched');
  });
});

describe('sniff', () => {
  it.each([
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), { type: 'image', mime: 'image/png' }],
    [new TextEncoder().encode('{"a":1}'), { type: 'json', text: '{\n  "a": 1\n}' }],
    [new TextEncoder().encode('# hi\n'), { type: 'text', text: '# hi\n' }],
    [new Uint8Array([0, 1, 2, 255]), { type: 'binary' }],
  ])('case %#', (bytes, expected) => {
    expect(sniff(bytes)).toEqual(expected);
  });
});
