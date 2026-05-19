import * as THREE from "three";
import { useEffect, useState } from "react";
import { drawBuiltin, type BuiltinId } from "./artworks";
import type { FinishId } from "../store";

export interface CoverTextureSet {
  map: THREE.Texture;
  roughnessMap: THREE.Texture | null;
  /** Physical material params keyed to the chosen print finish. */
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** Source pixel aspect (w/h), used to keep the product trim correct. */
  aspect: number;
}

const FINISH: Record<
  FinishId,
  { roughness: number; clearcoat: number; clearcoatRoughness: number; spot: boolean }
> = {
  matte: { roughness: 0.78, clearcoat: 0.0, clearcoatRoughness: 0.6, spot: false },
  gloss: { roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.06, spot: false },
  softtouch: { roughness: 0.92, clearcoat: 0.25, clearcoatRoughness: 0.9, spot: false },
  spotuv: { roughness: 0.7, clearcoat: 0.85, clearcoatRoughness: 0.12, spot: true },
};

function texFromCanvas(src: HTMLCanvasElement | HTMLImageElement) {
  const t = new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

/**
 * Spot-UV emulation: glossy varnish sits only on the inked / bright artwork.
 * We derive a roughness map from luminance so highlights catch a sharp
 * reflection while the rest of the stock stays papery.
 */
function buildSpotRoughness(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    // bright ink -> low roughness (glossy), paper -> high roughness
    const r = 235 - Math.min(200, lum * 0.85);
    p[i] = p[i + 1] = p[i + 2] = r;
    p[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function build(
  coverId: string,
  url: string,
  finish: FinishId,
): Promise<CoverTextureSet> {
  let src: HTMLCanvasElement | HTMLImageElement;
  if (url === "builtin") {
    src = drawBuiltin(coverId as BuiltinId);
  } else {
    src = await loadImage(url);
  }
  const w = "width" in src ? (src.width as number) : 1024;
  const h = "height" in src ? (src.height as number) : 1536;
  const f = FINISH[finish];
  return {
    map: texFromCanvas(src),
    roughnessMap: f.spot ? buildSpotRoughness(src, w, h) : null,
    roughness: f.roughness,
    clearcoat: f.clearcoat,
    clearcoatRoughness: f.clearcoatRoughness,
    aspect: w / h,
  };
}

/** Suspense-free hook: rebuilds whenever the cover or finish changes. */
export function useCoverTextures(
  coverId: string,
  url: string,
  finish: FinishId,
): CoverTextureSet | null {
  const [set, setSet] = useState<CoverTextureSet | null>(null);
  useEffect(() => {
    let alive = true;
    let current: CoverTextureSet | null = null;
    build(coverId, url, finish)
      .then((s) => {
        if (!alive) {
          s.map.dispose();
          s.roughnessMap?.dispose();
          return;
        }
        current = s;
        setSet(s);
      })
      .catch(() => alive && setSet(null));
    return () => {
      alive = false;
      current?.map.dispose();
      current?.roughnessMap?.dispose();
    };
  }, [coverId, url, finish]);
  return set;
}
