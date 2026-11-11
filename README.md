# buzz-cid-card

A Buzz desktop plugin. Paste a CID, an `ipfs://` link or a gateway URL in any channel and a card appears under the message: image, text, JSON, directory listing or file size, with the bytes verified against the CID on your machine.

## What it does

- Detects `ipfs://<cid>[/path]`, `https://<gateway>/ipfs/<cid>[/path]`, `https://<cid>.ipfs.<gateway>/…` and bare `bafy…` / `bafk…` / `Qm…` CIDs (decoded with `multiformats`, so look-alikes are ignored).
- Renders the card as a message accessory (`registerAccessory`, `placement: "message"`) so the original message text stays. `registerLink` only relabels IPFS links; a link renderer sits inside the host anchor, so a card there would be a giant link.
- Filecoin piece CIDs (`bafkzcib…`, CommP) get a card with copy and open; open uses the `/public/<piece>` form of the retrieval URL found in the same message, because `/piece/` redirects. No fetch or preview for pieces.
- Fetches lazily: nothing is requested until the card scrolls into view.

## How verification works

0. Delegated routing (`/routing/v1/providers/<cid>` on delegated-ipfs.dev, then cid.contact) lists content providers. Multiaddrs ending in `/https`, `/tls/http` or `/tls/sni/<name>/http` (libp2p.direct) become HTTPS gateway bases, providers announcing `transport-ipfs-gateway-http` first. Those bases are tried before the declared public gateways.
1. `GET /ipfs/<cid>[/path]?format=car&dag-scope=block` fetches just the root (and path) blocks.
2. Every block in the CAR is hashed locally (sha2-256) and compared with its CID before it is used. A mismatch shows a red "hash mismatch" and the bytes are never rendered.
3. The path is walked locally with `ipfs-unixfs-exporter`, which gives the type and size without fetching content.
4. Files up to 4 MiB are then fetched with `dag-scope=entity`, verified block by block, and assembled for the preview. Larger files show the size and a download button (up to the host's 16 MiB cap); above that, open in gateway.

The root and path blocks are fetched twice (once per scope); the gateway API has no way to ask for "entity minus these blocks".

Hand-rolled over `host.requestBytes` instead of `@helia/verified-fetch`: its trustless-gateway broker only exposes `transformRequestInit`, not an injectable fetch, and plain `fetch` is blocked by the host content security policy for plugins.

## Gateways

Sources are tried in order, first HTTP 200 wins: up to eight routed providers, then the declared public gateways https://trustless-gateway.link, https://ipfs.io, https://dweb.link.

Provider origins are discovered at runtime, so the manifest declares `host.dynamicUploads`, which the buzz-vault host patch extends to `host.requestBytes` for any public HTTPS address (DNS-pinned, one hop). Routers are declared in `host.networkOrigins`.

The host requires exact origins, so subdomain gateways (`<cid>.ipfs.dweb.link`) and FilBeam's per-wallet hosts cannot be declared. The host also sends no request headers and follows no redirects (`src-tauri/src/host_request.rs` builds every reqwest client with `redirect::Policy::none()`, line 1006 for byte requests), so the format goes in the query string and a gateway that 301s to another host counts as a failure.

As of 2026-11-10 that was every public gateway probed (`.review/gateway-probe.txt`): ipfs.io, dweb.link, w3s.link and nftstorage.link redirect trustless requests to trustless-gateway.link, which answered Cloudflare 522 or timed out. Routed providers answered directly (`.review/provider-probe.txt`), which is why routing comes first. With no provider and no gateway the card shows "could not fetch" with the last source's status.

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
- No redirects; sha2-256 CIDs verified, piece CIDs located only, other hashes ignored.
- Desktop only (`host.requestBytes`).
- API v1: one `plugin.js`, inline styles, no CSS files.
- HAMT-sharded directories are not listed.
