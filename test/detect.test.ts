import { describe, expect, it } from 'vitest';
import { findCids, isIpfsUrl } from '../src/detect.js';

const QM = 'QmQPeNsJPyVWPFDVHb77w8G42Fvo15z4bG2X8D2GhfbSXc';
const BAFY = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const BAFK = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';

describe('findCids', () => {
  it.each([
    [`see ${QM}/readme`, [`${QM}`]],
    [`ipfs://${BAFY}/a/b.txt ok`, [`${BAFY}/a/b.txt`]],
    [`https://ipfs.io/ipfs/${QM}/readme.`, [`${QM}/readme`]],
    [`https://${BAFY}.ipfs.dweb.link/x`, [`${BAFY}/x`]],
    [`bare ${BAFK} and (${BAFY})`, [BAFK, BAFY]],
    [`${BAFY} twice ${BAFY}`, [BAFY]],
    ['bafybeinotacidbecauseitisshortandinvalid', []],
    ['QmInvalidButRightLength0000000000000000000000000', []],
    ['https://example.com/ipfs/notacid', []],
    ['hello world', []],
  ])('%s', (text, keys) => {
    expect(findCids(text).map((r) => r.key)).toEqual(keys);
  });
  it('keeps the CID as a decoded object', () => {
    expect(findCids(QM)[0].cid.version).toBe(0);
  });
});

describe('isIpfsUrl', () => {
  it.each([
    [`ipfs://${BAFY}`, true],
    [`https://ipfs.io/ipfs/${QM}`, true],
    [`https://${BAFY}.ipfs.dweb.link/`, true],
    ['https://example.com/ipfs/nope', false],
    ['https://github.com/ipfs/kubo', false],
  ])('%s -> %s', (url, ok) => {
    expect(isIpfsUrl(url)).toBe(ok);
  });
});
