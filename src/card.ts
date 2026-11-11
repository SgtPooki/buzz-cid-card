import type * as ReactNs from 'react';
import type { CidRef } from './detect.js';
import { GATEWAYS, MAX_BYTES, fetchCar, type RequestBytes } from './fetch.js';
import { fileBytes, resolve, sniff, type Preview, type Resolved } from './content.js';

export const PREVIEW_MAX = 4 * 1024 * 1024;
const row = { display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' as const };
const mono = { fontFamily: 'monospace', fontSize: '0.85em' };
const pre = { ...mono, margin: 0, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const };

function short(cid: string) {
  return cid.length > 20 ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : cid;
}
function human(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}
function carCap(size: number) {
  return Math.min(MAX_BYTES, size + 65536 + (size >> 4));
}
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = { item: CidRef; open?: (url: string) => boolean };

export function makeCard(React: typeof ReactNs, request: RequestBytes): ReactNs.ComponentType<Props> {
  const h = React.createElement;
  return function Card({ item, open }: Props) {
    const { cid, path } = item;
    const ref = React.useRef<HTMLDivElement>(null);
    const [visible, setVisible] = React.useState(false);
    const [meta, setMeta] = React.useState<Resolved>();
    const [gateway, setGateway] = React.useState('');
    const [bytes, setBytes] = React.useState<Uint8Array>();
    const [preview, setPreview] = React.useState<Preview>();
    const [error, setError] = React.useState('');
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
      if (!ref.current) return;
      const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true));
      io.observe(ref.current);
      return () => io.disconnect();
    }, []);

    React.useEffect(() => {
      if (!visible) return;
      let live = true;
      (async () => {
        const head = await fetchCar(request, cid, path, 'block', 1024 * 1024);
        const resolved = await resolve(head.blocks, cid, path);
        if (!live) return;
        setMeta(resolved);
        setGateway(head.gateway);
        if (resolved.kind !== 'file' || resolved.size > PREVIEW_MAX) return;
        const full = await fetchCar(request, cid, path, 'entity', carCap(resolved.size));
        const data = await fileBytes(full.blocks, cid, path);
        if (!live) return;
        setBytes(data);
        setPreview(sniff(data));
      })().catch((e) => live && setError(String(e?.message ?? e)));
      return () => { live = false; };
    }, [visible]);

    const name = path ? path.split('/').pop()! : cid.toString();
    const gwUrl = `${gateway || GATEWAYS[0]}/ipfs/${cid}${path}`;
    const copy = () => navigator.clipboard.writeText(cid.toString()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    const save = async () => {
      if (bytes) return download(bytes, name);
      const full = await fetchCar(request, cid, path, 'entity', MAX_BYTES);
      download(await fileBytes(full.blocks, cid, path), name);
    };
    const openGw = (e: ReactNs.MouseEvent) => { if (open?.(gwUrl)) e.preventDefault(); };

    const mismatch = error.includes('hash mismatch');
    const canSave = meta?.kind === 'file' && meta.size <= MAX_BYTES;
    return h('div', { ref, className: 'ui-card', style: { padding: 'var(--space-2)', marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-2)', borderColor: mismatch ? 'var(--color-danger, red)' : undefined } },
      h('div', { style: row },
        h('span', { style: mono, title: cid.toString() }, short(cid.toString()) + path),
        h('button', { type: 'button', onClick: copy }, copied ? 'copied' : 'copy CID'),
        meta && h('span', { style: { color: 'var(--color-success, green)' }, title: 'every block hashed locally and matched its CID' }, '✓ verified'),
        meta && h('span', null, human(meta.size)),
        gateway && h('span', { style: { opacity: 0.7 } }, `via ${new URL(gateway).host}`),
        h('a', { href: gwUrl, target: '_blank', rel: 'noreferrer', onClick: openGw }, 'open'),
        canSave && h('button', { type: 'button', onClick: () => save().catch((e) => setError(String(e.message ?? e))) }, 'download'),
      ),
      error && h('p', { role: 'alert', style: { margin: 0, color: 'var(--color-danger, red)' } }, mismatch ? 'hash mismatch: bytes do not match the CID, not shown' : `could not fetch: ${error}`),
      !error && !meta && h('p', { style: { margin: 0, opacity: 0.7 } }, visible ? 'fetching…' : ''),
      meta && body(h, meta, preview, bytes),
    );
  };
}

function body(h: typeof ReactNs.createElement, meta: Resolved, preview: Preview | undefined, bytes: Uint8Array | undefined) {
  if (meta.kind === 'directory') {
    if (meta.sharded) return h('p', { style: { margin: 0 } }, 'sharded directory: open in gateway to browse');
    return h('ul', { style: { margin: 0, paddingLeft: '1.2em', ...mono } },
      meta.entries.map((e) => h('li', { key: e.name }, `${e.name}  ${human(e.size)}`)));
  }
  if (meta.kind === 'object') return h('p', { style: { margin: 0 } }, 'IPLD object (not UnixFS)');
  if (meta.size > PREVIEW_MAX) return h('p', { style: { margin: 0 } }, 'larger than the 4 MiB preview cap, download to view');
  if (!preview || !bytes) return h('p', { style: { margin: 0, opacity: 0.7 } }, 'loading preview…');
  if (preview.type === 'image') return h('img', { src: URL.createObjectURL(new Blob([bytes as BlobPart], { type: preview.mime })), alt: '', style: { maxWidth: '100%', maxHeight: 320 } });
  if (preview.type === 'binary') return h('p', { style: { margin: 0 } }, 'binary file');
  return h('pre', { style: pre }, preview.text);
}
