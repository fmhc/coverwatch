# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Coverwatch** is a marketing/review tool for cover designers (books + magazines). The
core idea: take a flat 2D cover artwork and show it **photorealistically inside a real
retail environment** — a bookshop table, a newspaper rack, a magazine spinner at a gas
station. The artwork is the input; the rendered "how it looks in the wild" shot is the
product. Photorealism and material quality are the headline feature, not an afterthought.

Two test artworks drive development and must always render correctly:
- A **fishing magazine** cover ("Angelmagazin").
- A **bestseller book** "KI frisst alles auf" by Finn.

## Stack

- **Vite + React + TypeScript** — app shell and UI chrome.
- **Three.js via @react-three/fiber** + **@react-three/drei** — the 3D scene. All scene
  code is R3F (declarative components), not imperative Three.js, unless a feature
  genuinely requires an escape hatch (then isolate it in a `useEffect`/`useFrame`).
- **@react-three/postprocessing** — bloom, SSR/reflection, tone mapping, DOF. The
  "photorealistic" look lives largely in the post stack + environment lighting, not just
  materials.
- **Zustand** — scene/editor state (selected scene, active cover, camera presets).
- **Tailwind** — 2D UI only. Never style 3D with it.

## Architecture

The mental model is **artwork → product geometry → staged scene → post-processed frame**.

- `src/scenes/` — each retail environment (bookshop table, gas-station rack, magazine
  spinner) is a self-contained scene component: geometry, lighting rig, camera presets,
  and the "slots" where products are placed. Scenes are interchangeable; a cover can be
  dropped into any scene. Adding an environment = adding one scene module here.
- `src/products/` — the **book** and **magazine** models. These are parametric (trim
  size, page count → spine thickness, cover stock → material) and take a cover texture
  set as input. A product is scene-agnostic. This is where material realism lives:
  paper/laminate/UV-spot/foil shaders, edge wear, page block.
- `src/covers/` — the 2D side: loading a cover artwork, splitting it into
  front/spine/back, generating the texture maps a product needs (albedo, roughness,
  normal from print finish). The bridge between flat input and 3D material.
- `src/lib/` — shared rendering helpers (env maps, color management, screenshot/export).
- `assets/covers/` — cached scraped reference covers (see Asset pipeline). **Generated,
  not hand-edited.** Treated as a cache; safe to delete and re-fetch.
- `scripts/` — Node-side tooling, primarily the cover scraper.

Color management is load-bearing for photorealism: textures that are color (albedo) must
be sRGB; data textures (roughness/normal/metalness) must be linear. Getting this wrong
makes everything look like a video game. Keep this consistent across `src/covers/`.

## Asset pipeline

`scripts/fetch-covers.*` populates `assets/covers/` and is run **out of band**, not at
build time:
- **Spiegel bestseller list** — fetch every book cover from the current list.
- **Magazines** — collect **≥100** magazine covers and cache them.
- Output: image files + a manifest JSON the app reads to populate the cover picker.

The app must work offline against the cached manifest — never fetch covers from the
browser at runtime. If the manifest is missing, the picker degrades to the two built-in
test artworks.

## Commands

> Scaffolding in progress. Once `package.json` exists, the canonical commands are:

- `npm run dev` — Vite dev server.
- `npm run build` — typecheck + production build.
- `npm run fetch-covers` — run the scraper into `assets/covers/` (network; not part of build).
- Tests: `npm test`; single test: `npm test -- <pattern>`.

Keep this section in sync with `package.json` scripts as they land.

## Working notes

- "Photorealism / high quality" is the acceptance bar for any visual change. A change
  that regresses the look of either test artwork is a regression even if code is cleaner.
- The two test artworks are the smoke test — render both in at least one scene before
  considering a rendering change done.
- Heavy/independent work (scraping, asset generation, scene research) is well suited to
  background sub-agents; the interactive scene work is not.
