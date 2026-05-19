<div align="center">

# 📚 Coverwatch

### See your cover *in the wild.*

A photoreal staging tool for **book & magazine cover designers** — drop a flat
2D artwork into a real retail environment and see how it actually looks on a
bookshop bargain table or a gas-station magazine gondola, with real print
finishes, real lighting, and real competing covers around it.

</div>

---

## Why

A cover never lives as a flat PNG. It lives **face-out on a shelf, half-lit,
next to forty other covers, slightly curled, behind acrylic.** Coverwatch
renders that — so the review conversation is "does it survive the shelf?"
instead of "does it look nice in Figma?".

## Features

- **Two retail scenes**
  - 🛍 **Bookshop bargain table** — a real table (top, apron, legs) on a
    reflective shop floor, a stepped riser of face-out bestsellers under a
    "BESTSELLER −30%" topper, loose face-up stacks of real books, your hero
    copy raised at the front.
  - ⛽ **Gas-station gondola** — metal-framed tiered slanted shelves,
    magazines *shingled* so every masthead peeks out, wire retainers, neutral
    fluorescent fill + a warm spot lifting your copy off the wall.
- **Parametric products** — casebound hardcover (page block, square spine,
  bevelled boards) and saddle-stitched glossy magazine (natural cover curl),
  both driven by trim/pages and a chosen **print finish**: Matte · Gloss ·
  Soft-touch · **Spot-UV** (gloss varnish only on the inked artwork).
- **Real competitor covers** — a scraped set (SPIEGEL bestseller books +
  100+ magazine covers) dresses the background so your cover is always judged
  in company. Falls back to two built-in test artworks offline.
- **Upload your own cover** — drop in a JPG/PNG and test it instantly. Saved
  in your browser (`localStorage`), no upload to any server.
- **Camera & zoom** — 7 viewpoints (Hero, 3/4, Browsing, Macro finish,
  Top-down, Raking light…), free orbit, damped zoom slider + buttons, reset.
- **AI realism pass** — sends the current render to ChatGPT and applies the
  returned exposure / glam / finish corrections, plus a written critique.
- **Export PNG** — one click, full-resolution frame.

## Stack

Vite · React · TypeScript · three.js (`@react-three/fiber` + `drei` +
`postprocessing`) · Zustand · Tailwind (2D UI only).

The "photoreal" look is mostly the **Lightformer studio environment** (offline,
no HDRI fetch), **MeshReflectorMaterial** floors, ACES tone mapping, a shared
micro-roughness grain map, and rounded edges — not just textures.

## Commands

```bash
npm install
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # typecheck + production build
npm run fetch-covers   # scrape covers into assets/covers/ (network; out of band)
```

`npm run fetch-covers` populates `assets/covers/` (book + magazine images +
`manifest.json`). It is **not** part of the build and the app never fetches
covers from the browser at runtime — it reads the cached manifest.

## Project layout

| Path | What |
|---|---|
| `src/scenes/` | One self-contained retail environment per file (geometry, lighting, hero slot). Scenes are interchangeable. |
| `src/products/` | Parametric `Book` / `Magazine` meshes — scene-agnostic, take a cover texture set. |
| `src/covers/` | Flat artwork → texture set (albedo sRGB, roughness/spot-UV linear), built-in procedural artworks, scraped-manifest + upload loaders. |
| `src/lib/` | Shared render helpers — studio env rig, micro-detail grain. |
| `scripts/fetch-covers.mjs` | The out-of-band cover scraper. |
| `assets/covers/` | Scraped cover cache + `manifest.json` (generated; safe to delete). |

## AI realism pass

The **✦ AI-Realismus** button posts the current canvas frame to a dev-only
endpoint (`/api/realism`, a Vite middleware). That middleware shells out to the
**Codex CLI** using the machine's existing ChatGPT login
(`~/.codex/auth.json` — no API key needed) and asks it to judge the render as a
photograph. The returned JSON (exposure, glam, finish hint, critique, concrete
fixes) is applied live and shown in a panel.

> Latency is variable (~1.5–5 min) because the Codex agent inspects the image
> and repo. The endpoint is dev-only and never ships to production builds.

## Test artworks

Two procedural covers always render even with no scraped assets and no network:

- **"KI frisst alles auf" — Finn** (bestseller book)
- **Angelmagazin 06/26** (fishing magazine)

A visual change that regresses either of these is a regression even if the
code is cleaner — they are the smoke test.

## License

MIT © 2026 Finn Malte Hinrichsen. Built at
[vibe-coding.hamburg](https://vibe-coding.hamburg).
