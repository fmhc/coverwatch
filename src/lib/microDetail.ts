import * as THREE from "three";

let grain: THREE.Texture | null = null;

/**
 * Shared tiling micro-detail map: fine paper grain + sparse "dust / micro
 * scratch" speckle. Used as a roughness map so print stock never reads as a
 * perfectly uniform plastic slab — directly addresses the AI realism note
 * "Materialien zu homogen, kaum Mikrokratzer/Staub".
 */
export function microRoughness(): THREE.Texture {
  if (grain) return grain;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // base paper grain around mid-grey
    const n = 150 + (Math.random() - 0.5) * 60;
    d[i] = d[i + 1] = d[i + 2] = n;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // a few faint scratches / dust flecks
  for (let k = 0; k < 90; k++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.06})`;
    ctx.lineWidth = Math.random() * 1.4;
    ctx.beginPath();
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
    ctx.stroke();
  }
  for (let k = 0; k < 140; k++) {
    ctx.fillStyle = `rgba(60,60,60,${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * S, Math.random() * S, Math.random() * 1.6, 0, 7);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 4);
  t.colorSpace = THREE.NoColorSpace;
  grain = t;
  return t;
}
