import { describe, expect, it } from 'vitest';
import { findCids, isIpfsUrl } from '../src/detect.js';

const QM = 'QmQPeNsJPyVWPFDVHb77w8G42Fvo15z4bG2X8D2GhfbSXc';
const BAFY = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const BAFK = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';
const PIECE = 'bafkzcibd4qeqovohe3xhi64gdmc42cerqil6fv5le3oibdk5gk7dksh3irhd5dqn';

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
    [`piece ${PIECE}`, [PIECE]],
  ])('%s', (text, keys) => {
    expect(findCids(text).map((r) => r.key)).toEqual(keys);
  });
  it('marks piece CIDs and takes the /public/ retrieval URL from the message', () => {
    expect(findCids(`piece ${PIECE}`)[0].piece).toBe('');
    expect(findCids(`saved ${PIECE} at https://calib.ezpdpz.net/piece/${PIECE}`)[0].piece).toBe(`https://calib.ezpdpz.net/public/${PIECE}`);
    expect(findCids(BAFY)[0].piece).toBeUndefined();
  });
  it('pairs a root CID with the piece CAR URL in a seal line', () => {
    const refs = findCids(`sealed ${BAFY} https://calib.ezpdpz.net/public/${PIECE}`);
    expect(refs.map((r) => [r.key, r.car])).toEqual([[BAFY, `https://calib.ezpdpz.net/public/${PIECE}`]]);
    expect(findCids(`just ${BAFY}`)[0].car).toBeUndefined();
  });
  it('reads a real seal card: viewer link, backticked ellipsis fragment, seal line', () => {
    const root = 'bafybeib43l2bzxoqpfo3zwxofvwxfq3twfc4w7lasgjmgezvlt5jhlmpp4';
    const piece = 'bafkzcibd5adqpojcbl5wy7hf7ihanxnudtorfyfojpcjsnxyhwfwu2sskrjuvxbv';
    const text = `**Scribe finished** · 2 signed messages verified · saved on Filecoin Calibration, data set 52644 · 2 copies\n[Open result](https://sgtpooki.github.io/buzz-vault/viewer.html?piece=${piece}&src=https%3A%2F%2Fcalib.ezpdpz.net%2Fpublic%2F${piece}) · piece \`bafkzcibd5ad…juvxbv\`\n${root} https://calib.ezpdpz.net/public/${piece}`;
    const url = `https://calib.ezpdpz.net/public/${piece}`;
    expect(findCids(text).map((r) => [r.key, r.car, r.piece])).toEqual([[piece, undefined, url], [root, url, undefined]]);
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
