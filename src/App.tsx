import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  useStore,
  type SceneId,
  type ProductKind,
  type FinishId,
  type Placement,
} from "./store";
import { useCoverTextures } from "./covers/coverTextures";
import { useLoadManifest } from "./covers/manifest";
import EnvRig from "./lib/EnvRig";
import BookshopTable from "./scenes/BookshopTable";
import MagazineRack from "./scenes/MagazineRack";
import Book from "./products/Book";
import Magazine from "./products/Magazine";

type Preset = {
  name: string;
  pos: [number, number, number];
  tgt: [number, number, number];
};

// Scene-specific framings. The bookshop hero sits low on a table at the
// origin; the gas-station hero sits high on a tall gondola — they need
// genuinely different camera rigs, not one set scaled by a fudge factor.
const PRESETS_BY_SCENE: Record<SceneId, Preset[]> = {
  bookshop: [
    // target raised to ~0.7 so the topper sign + standers on the back riser
    // are always in frame (they were getting clipped at the top)
    { name: "Hero", pos: [0, 1.1, 2.7], tgt: [0, 0.7, -0.2] },
    { name: "3/4 left", pos: [-1.9, 1.15, 2.35], tgt: [0, 0.7, -0.2] },
    { name: "3/4 right", pos: [1.9, 1.17, 2.3], tgt: [0, 0.7, -0.2] },
    { name: "Browsing", pos: [0.6, 1.95, 2.35], tgt: [0, 0.3, -0.3] },
    { name: "Macro finish", pos: [0.18, 0.85, 1.45], tgt: [0, 0.62, 0.45] },
    { name: "Flatlay", pos: [0.04, 2.9, 1.05], tgt: [0, 0.1, -0.2] },
    { name: "Raking light", pos: [-2.1, 0.85, 1.7], tgt: [0, 0.65, 0.1] },
  ],
  rack: [
    { name: "Hero", pos: [0, 1.5, 5.6], tgt: [0, 1.95, -0.85] },
    { name: "3/4 left", pos: [-3.0, 1.7, 5.0], tgt: [0, 1.95, -0.85] },
    { name: "3/4 right", pos: [3.05, 1.7, 4.9], tgt: [0, 1.95, -0.85] },
    { name: "Browsing", pos: [0.4, 3.1, 5.4], tgt: [0, 1.7, -1.0] },
    { name: "Macro finish", pos: [0.3, 1.4, 2.2], tgt: [0.28, 1.28, -0.6] },
    { name: "Low look-up", pos: [0, 0.6, 5.0], tgt: [0, 2.4, -0.9] },
    { name: "Raking light", pos: [-3.3, 1.7, 3.6], tgt: [0, 1.9, -0.85] },
  ],
};

// Names are shared across scenes (same index = same intent) for the UI.
const PRESETS = PRESETS_BY_SCENE.bookshop;

const MIN_DIST = 0.65;
const MAX_DIST = 9;
// The point the camera looks at / orbits around, vertically. Raising this is a
// pedestal move (target AND camera shift by the same dY) so the framing pans
// up the scene without changing angle or distance — needed to bring the whole
// tall kiosk rack into the shot.
const FOCUS_MIN = 0;
const FOCUS_MAX = 3.2;

// /api/realism is a dev-only Vite middleware (shells out to Codex). On the
// built/static deploy it doesn't exist, so the AI button is hidden there.
const AI_AVAILABLE = import.meta.env.DEV;

type Ctl = {
  target: THREE.Vector3;
  object: THREE.Camera;
  update: () => void;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};

/** Flies to a preset on change, then RELEASES control to OrbitControls so the
 *  user can freely orbit/zoom. Any manual interaction cancels the flight. */
function CameraRig({
  onDist,
  onFocusY,
}: {
  onDist: (d: number) => void;
  onFocusY: (y: number) => void;
}) {
  const preset = useStore((s) => s.cameraPreset);
  const scene = useStore((s) => s.scene);
  const nonce = useStore((s) => s.viewNonce);
  const { controls } = useThree() as unknown as { controls: Ctl | null };
  const cam = useThree((s) => s.camera);

  const wantPos = useRef(new THREE.Vector3(...PRESETS[0].pos));
  const wantTgt = useRef(new THREE.Vector3(...PRESETS[0].tgt));
  const flying = useRef(false);
  const tick = useRef(0);

  useEffect(() => {
    const list = PRESETS_BY_SCENE[scene];
    const p = list[preset] ?? list[0];
    wantPos.current.set(...p.pos);
    wantTgt.current.set(...p.tgt);
    flying.current = true;
  }, [preset, scene, nonce]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => (flying.current = false); // user grabbed the camera
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame(() => {
    if (flying.current) {
      cam.position.lerp(wantPos.current, 0.08);
      if (controls) {
        controls.target.lerp(wantTgt.current, 0.08);
        controls.update();
      }
      if (cam.position.distanceTo(wantPos.current) < 0.015) flying.current = false;
    }
    if (controls && ++tick.current % 6 === 0) {
      onDist(cam.position.distanceTo(controls.target));
      onFocusY(controls.target.y);
    }
  });
  return null;
}

export type ZoomApi = {
  zoomBy: (mult: number) => void;
  setDist: (d: number) => void;
  /** Pedestal: move the orbit focus (and camera) to this world Y. */
  setFocusY: (y: number) => void;
};

function ZoomController({ apiRef }: { apiRef: React.MutableRefObject<ZoomApi | null> }) {
  const { controls } = useThree() as unknown as { controls: Ctl | null };
  const cam = useThree((s) => s.camera);
  useEffect(() => {
    if (!controls) return;
    const dolly = (d: number) => {
      const dir = cam.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(d, MIN_DIST, MAX_DIST);
      cam.position.copy(controls.target).add(dir.setLength(len));
      controls.update();
    };
    apiRef.current = {
      zoomBy: (mult) =>
        dolly(cam.position.distanceTo(controls.target) * mult),
      setDist: (dist) => dolly(dist),
      setFocusY: (y) => {
        const ny = THREE.MathUtils.clamp(y, FOCUS_MIN, FOCUS_MAX);
        const dy = ny - controls.target.y;
        controls.target.y = ny;
        cam.position.y += dy;
        controls.update();
      },
    };
  }, [controls, cam, apiRef]);
  return null;
}

function Hero() {
  const product = useStore((s) => s.product);
  const scene = useStore((s) => s.scene);
  const finish = useStore((s) => s.finish);
  const coverId = useStore((s) => s.coverId);
  const covers = useStore((s) => s.covers);
  const autoSpin = useStore((s) => s.autoSpin);
  const url = useMemo(
    () => covers.find((c) => c.id === coverId)?.url ?? "builtin",
    [covers, coverId],
  );
  const tex = useCoverTextures(coverId, url, finish);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current && autoSpin) spin.current.rotation.y += dt * 0.35;
  });
  if (!tex) return null;
  return (
    <group ref={spin}>
      {product === "book" ? (
        <Book tex={tex} height={0.95} />
      ) : (
        <Magazine tex={tex} height={scene === "rack" ? 0.86 : 0.92} />
      )}
    </group>
  );
}

function Stage() {
  const scene = useStore((s) => s.scene);
  const hero = <Hero />;
  return scene === "bookshop" ? (
    <BookshopTable>{hero}</BookshopTable>
  ) : (
    <MagazineRack>{hero}</MagazineRack>
  );
}

export type CaptureApi = { save: () => void; grab: () => string };

function Capture({
  captureRef,
}: {
  captureRef: React.MutableRefObject<CaptureApi | null>;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const render = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    captureRef.current = {
      grab: render,
      save: () => {
        const a = document.createElement("a");
        a.href = render();
        a.download = `coverwatch-${Date.now()}.png`;
        a.click();
      },
    };
  }, [gl, scene, camera, captureRef]);
  return null;
}

/** Keeps the renderer exposure bound to the (AI-tunable) store value. */
function ExposureSync() {
  const exposure = useStore((s) => s.exposure);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
}

/* ---------------- UI ---------------- */

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl glass">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`chip px-3 py-1.5 rounded-lg text-xs font-semibold ${
            value === o.id ? "bg-white text-ink" : "text-white/70 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] tracking-[0.22em] text-white/40 font-bold">
        {title}
      </div>
      {children}
    </div>
  );
}

export default function App() {
  useLoadManifest();
  const s = useStore();
  const captureRef = useRef<CaptureApi | null>(null);
  const zoomRef = useRef<ZoomApi | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ProductKind>("book");
  const [dist, setDist] = useState(2.2);
  const [focusY, setFocusYState] = useState(0.6);
  const scenePresets = PRESETS_BY_SCENE[s.scene];
  const visibleCovers = s.covers.filter((c) => c.kind === tab).slice(0, 160);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      s.addUpload({
        id: `up-${Date.now()}`,
        label: f.name.replace(/\.[^.]+$/, ""),
        kind: tab,
        url: reader.result as string,
        uploaded: true,
      });
    };
    reader.readAsDataURL(f);
  }

  async function runRealism() {
    if (s.aiBusy || !captureRef.current) return;
    s.setAi("ChatGPT analysiert den Render … (kann ~1 Min dauern)", true);
    try {
      const image = captureRef.current.grab();
      const r = await fetch("/api/realism", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "AI-Fehler");
      if (typeof j.exposure === "number")
        s.setExposure(Math.max(0.6, Math.min(2, j.exposure)));
      if (typeof j.glam === "number")
        s.setGlam(Math.max(0, Math.min(1, j.glam)));
      if (["matte", "gloss", "softtouch", "spotuv"].includes(j.finishHint))
        s.setFinish(j.finishHint as FinishId);
      const fixes = Array.isArray(j.fixes) ? j.fixes : [];
      s.setAi(
        `🩺 ${j.critique || "—"}${fixes.length ? "\n• " + fixes.join("\n• ") : ""}`,
        false,
      );
    } catch (e) {
      s.setAi("⚠️ " + (e as Error).message, false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <color attach="background" args={["#08080a"]} />
        <PerspectiveCamera makeDefault fov={32} position={PRESETS[0].pos} />
        <Suspense fallback={null}>
          <EnvRig glam={s.glam} />
          <Stage />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          zoomSpeed={0.9}
          minDistance={MIN_DIST}
          maxDistance={MAX_DIST}
          maxPolarAngle={Math.PI / 1.9}
        />
        <CameraRig onDist={setDist} onFocusY={setFocusYState} />
        <ZoomController apiRef={zoomRef} />
        <ExposureSync />
        <Capture captureRef={captureRef} />
        <EffectComposer multisampling={8}>
          <Bloom
            mipmapBlur
            intensity={0.25 + s.glam * 0.6}
            luminanceThreshold={0.85}
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.25} darkness={0.62} />
          <SMAA />
        </EffectComposer>
      </Canvas>

      {/* legibility scrims so UI never fights the 3D subject */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

      {/* brand */}
      <div className="absolute top-6 left-7 rise pointer-events-none select-none">
        <div className="flex items-center gap-2 text-[13px] tracking-[0.32em] text-white/50 font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          COVERWATCH
        </div>
        <div className="text-2xl font-extrabold leading-tight mt-0.5">
          See your cover <span className="text-white/45">in the wild.</span>
        </div>
      </div>

      {/* footer credit */}
      <a
        href="https://github.com/fmhc/coverwatch"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 right-7 text-[10px] text-white/35 hover:text-white/70 transition-colors select-none"
      >
        open source · MIT · made at vibe-coding.hamburg ↗
      </a>

      {/* top-right */}
      <div className="absolute top-6 right-7 flex gap-2 rise">
        <button
          onClick={() => s.toggleSpin()}
          className={`chip glass px-4 py-2 rounded-xl text-xs font-semibold ${
            s.autoSpin ? "text-emerald-300" : ""
          }`}
        >
          ⟳ Spin
        </button>
        {/* AI realism needs the dev-only /api/realism (Codex) — hide it on
            the public static demo where that endpoint doesn't exist */}
        {AI_AVAILABLE && (
          <button
            onClick={runRealism}
            disabled={s.aiBusy}
            className={`chip px-4 py-2 rounded-xl text-xs font-bold ${
              s.aiBusy
                ? "glass text-white/50"
                : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
            }`}
          >
            {s.aiBusy ? "✦ analysiert …" : "✦ AI-Realismus"}
          </button>
        )}
        <button
          onClick={() => captureRef.current?.save()}
          className="chip px-4 py-2 rounded-xl text-xs font-bold bg-white text-ink"
        >
          ⤓ Export PNG
        </button>
      </div>

      {/* AI realism verdict */}
      {s.aiNotes && (
        <div className="absolute top-20 right-7 rise w-[320px] glass rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-line">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] tracking-[0.22em] text-white/40 font-bold">
              CHATGPT REALISM PASS
            </span>
            {!s.aiBusy && (
              <button
                onClick={() => s.setAi("", false)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          {s.aiNotes}
        </div>
      )}

      {/* left camera panel — anchored top-left under the brand, never crossing
          the centre of the viewport where the 3D product sits */}
      <div className="absolute top-28 left-7 rise w-[212px] max-h-[calc(100vh-13rem)] overflow-y-auto">
        <div className="glass rounded-2xl p-4 flex flex-col gap-5">
          <Section title="VIEWPOINT">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() =>
                  s.setPreset(
                    (s.cameraPreset + scenePresets.length - 1) %
                      scenePresets.length,
                  )
                }
                className="chip glass w-8 h-8 rounded-lg text-sm"
              >
                ‹
              </button>
              <div className="text-sm font-bold flex-1 text-center">
                {(scenePresets[s.cameraPreset] ?? scenePresets[0]).name}
              </div>
              <button
                onClick={() => s.cyclePreset(scenePresets.length)}
                className="chip glass w-8 h-8 rounded-lg text-sm"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {scenePresets.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => s.setPreset(i)}
                  className={`chip rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                    s.cameraPreset === i
                      ? "bg-white text-ink"
                      : "glass text-white/70 hover:text-white"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Section>

          <Section title={`ZOOM · ${dist.toFixed(2)}m`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => zoomRef.current?.zoomBy(1.18)}
                className="chip glass w-8 h-8 rounded-lg text-base font-bold"
              >
                −
              </button>
              <input
                type="range"
                min={MIN_DIST}
                max={MAX_DIST}
                step={0.01}
                value={dist}
                onChange={(e) => {
                  const d = parseFloat(e.target.value);
                  setDist(d);
                  zoomRef.current?.setDist(d);
                }}
                className="accent-white flex-1"
              />
              <button
                onClick={() => zoomRef.current?.zoomBy(0.85)}
                className="chip glass w-8 h-8 rounded-lg text-base font-bold"
              >
                +
              </button>
            </div>
            <button
              onClick={() => s.resetView()}
              className="chip glass rounded-lg py-2 text-xs font-semibold w-full"
            >
              ⟲ Reset view
            </button>
          </Section>

          <Section title={`FOCUS HEIGHT · ${focusY.toFixed(2)}m`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const y = Math.max(FOCUS_MIN, focusY - 0.15);
                  setFocusYState(y);
                  zoomRef.current?.setFocusY(y);
                }}
                title="lower the point the camera looks at"
                className="chip glass w-8 h-8 rounded-lg text-base font-bold"
              >
                ↓
              </button>
              <input
                type="range"
                min={FOCUS_MIN}
                max={FOCUS_MAX}
                step={0.02}
                value={focusY}
                onChange={(e) => {
                  const y = parseFloat(e.target.value);
                  setFocusYState(y);
                  zoomRef.current?.setFocusY(y);
                }}
                className="accent-white flex-1"
              />
              <button
                onClick={() => {
                  const y = Math.min(FOCUS_MAX, focusY + 0.15);
                  setFocusYState(y);
                  zoomRef.current?.setFocusY(y);
                }}
                title="raise the point the camera looks at"
                className="chip glass w-8 h-8 rounded-lg text-base font-bold"
              >
                ↑
              </button>
            </div>
          </Section>

          <Section title="STUDIO GLAM">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.glam}
              onChange={(e) => s.setGlam(parseFloat(e.target.value))}
              className="accent-white w-full"
            />
          </Section>
        </div>
      </div>

      {/* bottom deck */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rise flex flex-col items-center gap-3 w-[min(900px,80vw)]">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Seg<SceneId>
            value={s.scene}
            onChange={s.setScene}
            options={[
              { id: "bookshop", label: "🛍 Bookshop table" },
              { id: "rack", label: "⛽ Kiosk rack" },
            ]}
          />
          <Seg<ProductKind>
            value={s.product}
            onChange={(p) => {
              s.setProduct(p);
              setTab(p);
            }}
            options={[
              { id: "book", label: "Book" },
              { id: "magazine", label: "Magazine" },
            ]}
          />
          <Seg<FinishId>
            value={s.finish}
            onChange={s.setFinish}
            options={[
              { id: "matte", label: "Matte" },
              { id: "gloss", label: "Gloss" },
              { id: "softtouch", label: "Soft-touch" },
              { id: "spotuv", label: "Spot-UV" },
            ]}
          />
          <Seg<Placement>
            value={s.placement}
            onChange={s.setPlacement}
            options={[
              { id: "highlight", label: "★ Highlight" },
              { id: "insitu", label: "🛒 In situ" },
            ]}
          />
        </div>

        <div className="glass rounded-2xl p-3 w-full">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              title={`Upload a ${tab} cover (kept in this browser)`}
              className="chip shrink-0 rounded-lg border-2 border-dashed border-white/25 hover:border-white/60 grid place-items-center text-center"
              style={{ width: 60, height: 86 }}
            >
              <span className="text-[10px] font-bold leading-tight px-1">
                ＋<br />
                Upload
              </span>
            </button>
            {visibleCovers.map((c) => (
              <div
                key={c.id}
                title={c.label}
                onClick={() => s.setCover(c.id)}
                className={`chip relative shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer ${
                  s.coverId === c.id
                    ? "border-white"
                    : "border-white/10 hover:border-white/40"
                }`}
                style={{ width: 60, height: 86 }}
              >
                {c.url === "builtin" ? (
                  <div className="h-full w-full bg-gradient-to-br from-sky-500/40 to-fuchsia-500/30 grid place-items-center text-[9px] font-bold px-1 text-center">
                    {c.label.split("—")[0]}
                  </div>
                ) : (
                  <img
                    src={c.url}
                    alt={c.label}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                {c.uploaded && (
                  <>
                    <span className="absolute top-0 left-0 bg-violet-500 text-[8px] font-bold px-1 rounded-br">
                      U
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        s.removeUpload(c.id);
                      }}
                      className="absolute top-0 right-0 bg-black/70 text-[10px] px-1 rounded-bl hover:bg-red-600"
                    >
                      ✕
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/35 mt-2 px-1">
            {visibleCovers.length} {tab} covers · upload your own (saved in
            this browser via localStorage) · drag to orbit · scroll/slider to
            zoom
          </div>
        </div>
      </div>
    </div>
  );
}
