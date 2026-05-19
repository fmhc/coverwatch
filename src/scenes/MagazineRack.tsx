import { ReactNode, useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useScrapedTextures } from "../covers/useScrapedTextures";
import { useStore } from "../store";

const HERO_ROW = 1;
const HERO_COL = 4;
// Each higher row recedes in Z so the vertically-overlapping (shingled) rows
// never intersect — that was the "3D-Objekte schneiden sich" bug.
const zRow = (r: number) => SHELF_Z - r * 0.13;

const METAL = new THREE.MeshStandardMaterial({
  color: "#3a3f45",
  roughness: 0.45,
  metalness: 0.75,
});
const TILT = -0.3;
const ROWS = 5;
const ROW_H = 0.6;
const BASE_Y = 0.2;
const SHELF_Z = -0.45;
const MAG_H = 0.78;

function headerTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 160;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0f3d6b";
  x.fillRect(0, 0, 1024, 160);
  x.fillStyle = "#ffd23f";
  x.fillRect(0, 132, 1024, 12);
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.font = "800 86px Inter, sans-serif";
  x.fillText("ZEITSCHRIFTEN  ·  MAGAZINES", 512, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Gas-station **tiered gondola**: a metal-framed wall of slanted stepped
 * shelves, each carrying real magazines **shingled** so every masthead peeks
 * over the copy in front, a clear acrylic retainer strip on each shelf, a blue
 * "ZEITSCHRIFTEN" header, cool fluorescent ceiling light + a warm spot that
 * lifts the reviewed copy off the busy wall. Tiled, reflective station floor.
 */
export default function MagazineRack({ children }: { children: ReactNode }) {
  const bg = useScrapedTextures("magazine", 44);
  const placement = useStore((s) => s.placement);

  const rows = useMemo(
    () =>
      Array.from({ length: ROWS }).map((_, r) => {
        const cols = 8;
        return {
          r,
          y: BASE_Y + r * ROW_H,
          cols: Array.from({ length: cols }).map((_, k) => ({
            x: -2.45 + k * 0.62,
            isHero: r === HERO_ROW && k === HERO_COL,
            ci: r * cols + k,
          })),
        };
      }),
    [],
  );

  return (
    <group>
      {/* tiled station floor with reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0.7]} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <MeshReflectorMaterial
          color={"#0e0f12"}
          roughness={0.6}
          metalness={0.2}
          resolution={1024}
          mirror={0.25}
          mixStrength={0.8}
          mixBlur={1.4}
          blur={[600, 220]}
          depthScale={1}
        />
      </mesh>

      {/* gondola back panel */}
      <mesh position={[0, 1.5, SHELF_Z - 0.32]} receiveShadow>
        <planeGeometry args={[6.4, 4.2]} />
        <meshStandardMaterial color={"#1a1d22"} roughness={0.9} />
      </mesh>
      {/* metal side uprights */}
      {[-2.85, 2.85].map((x, i) => (
        <mesh key={i} position={[x, 1.4, SHELF_Z - 0.1]} material={METAL}>
          <boxGeometry args={[0.07, 3.6, 0.5]} />
        </mesh>
      ))}

      {/* header */}
      <mesh position={[0, BASE_Y + ROWS * ROW_H - 0.05, SHELF_Z - 0.05]}>
        <boxGeometry args={[5.7, 0.34, 0.04]} />
        <meshStandardMaterial map={useMemo(headerTexture, [])} toneMapped={false} />
      </mesh>

      {/* shelves + shingled magazines (each row stepped back in Z) */}
      {rows.map((row) => {
        const z = zRow(row.r);
        return (
          <group key={row.r}>
            {/* metal shelf */}
            <mesh
              position={[0, row.y - MAG_H / 2 - 0.03, z + 0.12]}
              rotation={[TILT, 0, 0]}
              material={METAL}
              receiveShadow
            >
              <boxGeometry args={[5.7, 0.03, 0.46]} />
            </mesh>
            {/* thin metal retainer wire */}
            <mesh
              position={[0, row.y - MAG_H / 2 + 0.06, z + 0.34]}
              rotation={[TILT, 0, 0]}
              material={METAL}
            >
              <boxGeometry args={[5.7, 0.022, 0.014]} />
            </mesh>

            {row.cols.map((c, k) => {
              const r = (n: number) => {
                const v = Math.sin(c.ci * 12.9898 + n * 78.233) * 43758.5453;
                return v - Math.floor(v);
              };
              if (c.isHero) {
                // highlight: pulled forward off the wall + spotlit.
                // insitu: sits flush in its slot like any other copy.
                const pos: [number, number, number] =
                  placement === "highlight"
                    ? [0, row.y + 0.05, z + 0.5]
                    : [c.x, row.y, z + k * 0.012];
                return (
                  <group key={k} position={pos} rotation={[TILT, 0, 0]}>
                    {children}
                  </group>
                );
              }
              const cover = bg[c.ci % Math.max(1, bg.length)];
              if (!cover) return null;
              const w = MAG_H * cover.aspect;
              const jx = (r(1) - 0.5) * 0.05;
              const jy = (r(2) - 0.5) * 0.04;
              const jrz = (r(3) - 0.5) * 0.05;
              return (
                <mesh
                  key={k}
                  position={[c.x + jx, row.y + jy, z + k * 0.012 + r(4) * 0.006]}
                  rotation={[TILT, 0, jrz]}
                >
                  <planeGeometry args={[w, MAG_H]} />
                  <meshPhysicalMaterial
                    map={cover.tex}
                    color={placement === "insitu" ? "#c4c4c8" : "#96969c"}
                    roughness={0.42 + r(5) * 0.18}
                    clearcoat={0.3}
                    clearcoatRoughness={0.3 + r(6) * 0.2}
                    envMapIntensity={0.55}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* neutral fluorescent fill — brighter & even in-situ (real kiosk
          lighting), plus a warm hero key only when highlighting */}
      <hemisphereLight
        args={["#eef0f3", "#1a1b1e", placement === "insitu" ? 0.85 : 0.55]}
      />
      <directionalLight
        position={[0.5, 5, 3]}
        intensity={placement === "insitu" ? 1.5 : 1.0}
        color={"#f4f1ec"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      {placement === "highlight" && (
        <spotLight
          position={[0.7, 2.7, 2.7]}
          target-position={[0, BASE_Y + HERO_ROW * ROW_H, zRow(HERO_ROW) + 0.5]}
          angle={0.38}
          penumbra={0.45}
          intensity={34}
          color={"#fff2de"}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
      )}

      <ContactShadows
        position={[0, -0.02, 0.6]}
        opacity={0.7}
        scale={6}
        blur={1.6}
        far={1.8}
      />
    </group>
  );
}
