import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useStore, type ProductKind } from "../store";

function shuffle<T>(arr: T[], seed = 1) {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BgCover {
  tex: THREE.Texture;
  aspect: number;
}

/**
 * Loads up to `count` real scraped covers of the given kind as textures, for
 * dressing the background of a scene (decoy stacks / a full rack). Falls back
 * to an empty list before the manifest has loaded; never throws on a bad URL.
 */
export function useScrapedTextures(kind: ProductKind, count: number): BgCover[] {
  const covers = useStore((s) => s.covers);
  const picked = useMemo(() => {
    const pool = covers.filter(
      (c) => c.kind === kind && c.url !== "builtin" && !c.uploaded,
    );
    return shuffle(pool, 7).slice(0, count);
  }, [covers, kind, count]);
  const [out, setOut] = useState<BgCover[]>([]);

  useEffect(() => {
    let alive = true;
    const made: BgCover[] = [];
    Promise.all(
      picked.map(
        (c) =>
          new Promise<void>((res) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const t = new THREE.Texture(img);
              t.colorSpace = THREE.SRGBColorSpace;
              t.anisotropy = 8;
              t.needsUpdate = true;
              made.push({ tex: t, aspect: img.width / img.height || 0.66 });
              res();
            };
            img.onerror = () => res();
            img.src = c.url;
          }),
      ),
    ).then(() => {
      if (alive) setOut(made);
      else made.forEach((m) => m.tex.dispose());
    });
    return () => {
      alive = false;
      made.forEach((m) => m.tex.dispose());
    };
  }, [picked]);

  return out;
}
