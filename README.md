# buzz-cid-card

A Buzz desktop plugin. Paste a CID, an `ipfs://` link or a gateway URL in any channel and a card appears under the message: image, text, JSON, directory listing or file size, with the bytes verified against the CID on your machine.

## What it does

- Detects `ipfs://<cid>[/path]`, `https://<gateway>/ipfs/<cid>[/path]`, `https://<cid>.ipfs.<gateway>/…` and bare `bafy…` / `bafk…` / `Qm…` CIDs (decoded with `multiformats`, so look-alikes are ignored).
- Renders the card as a message accessory (`registerAccessory`, `placement: "message"`) so the original message text stays. `registerLink` only relabels IPFS links; a link renderer sits inside the host anchor, so a card there would be a giant link.
- Fetches lazily: nothing is requested until the card scrolls into view.

## How verification works

1. `GET /ipfs/<cid>[/path]?format=car&dag-scope=block` fetches just the root (and path) blocks.
2. Every block in the CAR is hashed locally (sha2-256) and compared with its CID before it is used. A mismatch shows a red "hash mismatch" and the bytes are never rendered.
3. The path is walked locally with `ipfs-unixfs-exporter`, which gives the type and size without fetching content.
4. Files up to 4 MiB are then fetched with `dag-scope=entity`, verified block by block, and assembled for the preview. Larger files show the size and a download button (up to the host's 16 MiB cap); above that, open in gateway.

The root and path blocks are fetched twice (once per scope); the gateway API has no way to ask for "entity minus these blocks".

Hand-rolled over `host.requestBytes` instead of `@helia/verified-fetch`: its trustless-gateway broker only exposes `transformRequestInit`, not an injectable fetch, and plain `fetch` is blocked by the host content security policy for plugins.

## Gateways

Declared in `manifest.json` `host.networkOrigins`, tried in order, first HTTP 200 wins:

1. https://trustless-gateway.link
2. https://ipfs.io
3. https://dweb.link

The host requires exact origins, so subdomain gateways (`<cid>.ipfs.dweb.link`) and FilBeam's per-wallet hosts cannot be declared. The host also sends no request headers and follows no redirects (`src-tauri/src/host_request.rs`, `read_bytes` / `plugin_host_request_bytes`), so the format goes in the query string and a gateway that 301s to another host counts as a failure.

## Install

```sh
pnpm install
pnpm build          # dist/plugin.js + dist/manifest.json
buzzodz plugin install "$PWD/dist"
buzzodz plugin enable sgtpooki.buzz-cid-card
```

Or Settings → Plugins → Add → Browse, pick `dist/`.

## Limits

- 16 MiB per request (host cap), 4 MiB preview cap.
- Declared gateways only; no redirects; sha2-256 CIDs only (others show "cannot verify").
- Desktop only (`host.requestBytes`).
- API v1: one `plugin.js`, inline styles, no CSS files.
- HAMT-sharded directories are not listed.
