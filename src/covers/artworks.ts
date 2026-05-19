// Procedural built-in test artworks. These exist so Coverwatch is fully usable
// before any covers are scraped: a bestseller book and a fishing magazine,
// drawn at print resolution onto a canvas and consumed as a cover texture.

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bestseller: "KI frisst alles auf" — Finn. Dark, ominous, high contrast. */
export function drawKiBook(): HTMLCanvasElement {
  const W = 1240;
  const H = 1850;
  const { c, ctx } = makeCanvas(W, H);

  // Deep graphite base with a cold vignette.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0d12");
  bg.addColorStop(0.55, "#10141c");
  bg.addColorStop(1, "#05060a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // "Devouring" pixel field: a maw of dissolving squares climbing the cover.
  for (let i = 0; i < 1400; i++) {
    const t = Math.random();
    const y = H - t * H * 1.05;
    const spread = 60 + (1 - t) * (W * 0.7);
    const x = W / 2 + (Math.random() - 0.5) * spread;
    const s = 4 + Math.random() * (10 + (1 - t) * 26);
    const a = 0.05 + (1 - t) * 0.5;
    ctx.fillStyle = `rgba(${90 + Math.random() * 60}, ${
      200 + Math.random() * 55
    }, 255, ${a})`;
    ctx.fillRect(x, y, s, s);
  }

  // Cyan core glow.
  const glow = ctx.createRadialGradient(W / 2, H * 0.62, 20, W / 2, H * 0.62, 620);
  glow.addColorStop(0, "rgba(70,220,255,0.32)");
  glow.addColorStop(1, "rgba(70,220,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // SPIEGEL bestseller flash.
  ctx.save();
  ctx.translate(W - 250, 150);
  ctx.rotate(-0.14);
  ctx.fillStyle = "#e0241b";
  roundRect(ctx, -120, -42, 240, 84, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 30px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SPIEGEL", 0, -14);
  ctx.fillText("BESTSELLER", 0, 18);
  ctx.restore();

  // Title.
  ctx.fillStyle = "#f5f7fb";
  ctx.textAlign = "center";
  ctx.font = "800 132px Inter, sans-serif";
  ctx.fillText("KI FRISST", W / 2, 560);
  ctx.fillText("ALLES", W / 2, 700);
  ctx.fillStyle = "#46dcff";
  ctx.fillText("AUF", W / 2, 840);

  // Hairline rule + tagline.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, 905);
  ctx.lineTo(W / 2 + 260, 905);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,230,245,0.78)";
  ctx.font = "500 30px Inter, sans-serif";
  ctx.fillText("Wie eine Intelligenz lernte, alles zu verschlingen.", W / 2, 955);

  // Author.
  ctx.fillStyle = "#f5f7fb";
  ctx.font = "700 92px Inter, sans-serif";
  ctx.fillText("FINN", W / 2, H - 150);

  return c;
}

/** "Angelmagazin" — fishing magazine: masthead, cover lines, price flash. */
export function drawAngelmagazin(): HTMLCanvasElement {
  const W = 1240;
  const H = 1620;
  const { c, ctx } = makeCanvas(W, H);

  // Water: teal-to-deep gradient with light shafts.
  const water = ctx.createLinearGradient(0, 0, 0, H);
  water.addColorStop(0, "#0e5c63");
  water.addColorStop(0.5, "#0a3f55");
  water.addColorStop(1, "#06212f");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * W + 40;
    const g = ctx.createLinearGradient(x, 0, x + 120, H);
    g.addColorStop(0, "rgba(180,255,245,0.10)");
    g.addColorStop(1, "rgba(180,255,245,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 140, 0);
    ctx.lineTo(x + 360, H);
    ctx.lineTo(x + 220, H);
    ctx.closePath();
    ctx.fill();
  }
  // Caustic ripples.
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(190,255,248,${0.02 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * H;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      W * 0.3,
      y + (Math.random() - 0.5) * 80,
      W * 0.7,
      y + (Math.random() - 0.5) * 80,
      W,
      y,
    );
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // Top darkening for masthead legibility.
  const top = ctx.createLinearGradient(0, 0, 0, 360);
  top.addColorStop(0, "rgba(0,0,0,0.45)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 360);

  // Masthead.
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 150px Inter, sans-serif";
  ctx.fillText("ANGEL", W / 2 - 6, 180);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "800 150px Inter, sans-serif";
  ctx.fillText("MAGAZIN", W / 2, 320);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 32px Inter, sans-serif";
  ctx.fillText("RAUBFISCH · KARPFEN · FLIEGE · MEER", W / 2, 372);

  // Cover lines.
  const cover: [string, string][] = [
    ["HECHT IM HERBST", "12 Hotspots, an denen jetzt die Großen beißen"],
    ["KARPFEN XXL", "Boilie-Strategie für 20-Pfünder"],
    ["FLIEGENFISCHEN", "Wurftechnik-Workshop mit Profi-Guide"],
    ["MEERESANGELN", "Norwegen-Special: Dorsch & Köhler"],
  ];
  ctx.textAlign = "left";
  let y = 560;
  for (const [head, sub] of cover) {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "800 60px Inter, sans-serif";
    ctx.fillText(head, 70, y);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "500 30px Inter, sans-serif";
    ctx.fillText(sub, 72, y + 44);
    y += 150;
  }

  // Big feature badge.
  ctx.save();
  ctx.translate(W - 210, H - 230);
  ctx.rotate(-0.12);
  ctx.fillStyle = "#e0241b";
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "800 40px Inter, sans-serif";
  ctx.fillText("GRATIS", 0, -16);
  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillText("Köder-Set", 0, 18);
  ctx.fillText("im Heft", 0, 48);
  ctx.restore();

  // Footer bar: issue + barcode + price.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, H - 90, W, 90);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText("Ausgabe 06 · Juni 2026 · € 6,90", 50, H - 36);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 28; i++) {
    if (Math.random() > 0.4)
      ctx.fillRect(W - 230 + i * 6, H - 74, 2 + Math.random() * 3, 56);
  }

  return c;
}

export type BuiltinId = "ki-frisst-alles" | "angelmagazin";

export function drawBuiltin(id: BuiltinId): HTMLCanvasElement {
  return id === "angelmagazin" ? drawAngelmagazin() : drawKiBook();
}
