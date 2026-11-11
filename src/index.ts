import type { Context } from '@buzz/author';
import { findCids, isIpfsUrl } from './detect.js';
import { makeCard } from './card.js';

export const inject = ['react', 'conversation', 'host'];

export function apply(ctx: Context) {
  const React = ctx.react;
  const request = ctx.host.requestBytes;
  if (!request) throw new Error('host.requestBytes unavailable (desktop only)');
  const Card = makeCard(React, (input) => request.call(ctx.host, input), (input) => ctx.host.request(input));

  ctx.conversation.registerLink({
    id: 'ipfs-link',
    title: 'IPFS link',
    matches: isIpfsUrl,
    component: ({ url }) => React.createElement('span', { style: { fontFamily: 'monospace' } }, 'ipfs ' + findCids(url).map((r) => r.key).join(' ')),
  });

  // Accessory keeps the original message text; a message renderer would replace it.
  ctx.conversation.registerAccessory({
    id: 'cid-cards',
    title: 'CID cards',
    placement: 'message',
    component: (props) => {
      const refs = findCids(props.message?.content ?? '');
      if (!refs.length) return null;
      return React.createElement('div', { style: { width: '100%' } }, refs.map((r) => React.createElement(Card, { key: r.key, item: r, open: props.open })));
    },
  });
}
