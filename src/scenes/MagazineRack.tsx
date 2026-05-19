import { ReactNode, useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useScrapedTextures } from "../covers/useScrapedTextures";
import { useStore } from "../store";

const METAL = new THREE.MeshStandardMaterial({
  color: "#3a3f45",
  roughness: 0.45,
  metalness: 0.75,
});
const TILT = -0.3; // slight lean-back, same skew for every copy incl. hero
// Real kiosk racks are STAIRCASED: each higher row sits higher AND further
// back. ROW_H must clear a FULL magazine + the next shelf board, otherwise the
// upper shelf/rail cuts across the tops of the row below (the reported bug).
const ROWS = 4;
const COLS = 10;
const MAG_H = 0.86;
const ROW_H = 0.98; // > MAG_H + shelf → every magazine fully clears the next shelf
const ROW_DZ = 0.36; // each higher row well behind the one in front
const COL_DX = 0.56; // covers touch / slightly overlap side to side
const COL_X0 = -((COLS - 1) * COL_DX) / 2;
const BASE_Y = 0.3;
const SHELF_Z = -0.3;
const HERO_ROW = 1;
const HERO_COL = 5;
const zRow = (r: number) => SHELF_Z - r * ROW_DZ;
const BACK_Z = SHELF_Z - (ROWS - 1) * ROW_DZ - 0.5;

function headerTexture() {
  // Canvas aspect matches the header box (5.7 × 0.34 ≈ 16.8:1) so the text
  // isn't stretched, and the font auto-shrinks to never overflow.
  const W = 1680;
  const H = 100;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0f3d6b";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#ffd23f";
  x.fillRect(0, H - 9, W, 9);
  const label = "ZEITSCHRIFTEN";
  let fs = 58;
  x.font = `800 ${fs}px Inter, sans-serif`;
  while (x.measureText(label).width > W * 0.82 && fs > 20) {
    fs -= 2;
    x.font = `800 ${fs}px Inter, sans-serif`;
  }
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(label, W / 2, H / 2 - 3);
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
  const bg = useScrapedTextures("magazine", ROWS * COLS);
  const placement = useStore((s) => s.placement);

  const rows = useMemo(
    () =>
      Array.from({ length: ROWS }).map((_, r) => ({
        r,
        y: BASE_Y + r * ROW_H,
        cols: Array.from({ length: COLS }).map((_, k) => ({
          x: COL_X0 + k * COL_DX,
          isHero: r === HERO_ROW && k === HERO_COL,
          ci: r * COLS + k,
        })),
      })),
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

      {/* gondola back panel — behind the deepest (top) row */}
      <mesh position={[0, 2.0, BACK_Z]} receiveShadow>
        <planeGeometry args={[6.6, 5.0]} />
        <meshStandardMaterial color={"#1a1d22"} roughness={0.9} />
      </mesh>
      {/* metal side uprights spanning the full staircase */}
      {[-2.95, 2.95].map((x, i) => (
        <mesh
          key={i}
          position={[x, 2.0, (SHELF_Z + BACK_Z) / 2]}
          material={METAL}
        >
          <boxGeometry args={[0.07, 4.8, Math.abs(BACK_Z - SHELF_Z) + 0.4]} />
        </mesh>
      ))}

      {/* header — above the top (deepest) row */}
      <mesh
        position={[
          0,
          BASE_Y + (ROWS - 1) * ROW_H + MAG_H * 0.55,
          zRow(ROWS - 1) - 0.02,
        ]}
        rotation={[TILT, 0, 0]}
      >
        <boxGeometry args={[5.9, 0.36, 0.04]} />
        <meshStandardMaterial map={useMemo(headerTexture, [])} toneMapped={false} />
      </mesh>

      {/* staircased rows: each higher row is up AND back; the front row's
          shelf+rail only hides the thin bottom edge of the row behind */}
      {rows.map((row) => {
        const z = zRow(row.r);
        return (
          <group key={row.r}>
            {/* metal shelf the copies stand on */}
            <mesh
              position={[0, row.y - MAG_H / 2 - 0.04, z + 0.16]}
              rotation={[TILT, 0, 0]}
              material={METAL}
              receiveShadow
            >
              <boxGeometry args={[5.9, 0.04, 0.42]} />
            </mesh>
            {/* retainer rail — the lip the magazines lean on / tuck behind */}
            <mesh
              position={[0, row.y - MAG_H / 2 + 0.07, z + 0.32]}
              rotation={[TILT, 0, 0]}
              material={METAL}
            >
              <boxGeometry args={[5.9, 0.03, 0.016]} />
            </mesh>

            {row.cols.map((c, k) => {
              const r = (n: number) => {
                const v = Math.sin(c.ci * 12.9898 + n * 78.233) * 43758.5453;
                return v - Math.floor(v);
              };
              const jx = (r(1) - 0.5) * 0.04;
              const jy = (r(2) - 0.5) * 0.03;
              const jrz = (r(3) - 0.5) * 0.05;
              const pz = z + k * 0.006 + r(4) * 0.005;
              if (c.isHero) {
                // Same size, slot, skew & jitter as every other copy — only
                // the spotlight (in highlight mode) sets it apart.
                return (
                  <group
                    key={k}
                    position={[c.x + jx, row.y + jy, pz]}
                    rotation={[TILT, 0, jrz]}
                  >
                    {children}
                  </group>
                );
              }
              const cover = bg[c.ci % Math.max(1, bg.length)];
              if (!cover) return null;
              const w = MAG_H * cover.aspect;
              return (
                <mesh
                  key={k}
                  position={[c.x + jx, row.y + jy, pz]}
                  rotation={[TILT, 0, jrz]}
                >
                  <planeGeometry args={[w, MAG_H]} />
                  <meshPhysicalMaterial
                    map={cover.tex}
                    color={placement === "insitu" ? "#cdcdd2" : "#aaaab0"}
                    roughness={0.42 + r(5) * 0.18}
                    clearcoat={0.3}
                    clearcoatRoughness={0.3 + r(6) * 0.2}
                    envMapIntensity={0.6}
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
          position={[
            COL_X0 + HERO_COL * COL_DX + 0.5,
            BASE_Y + HERO_ROW * ROW_H + 1.5,
            zRow(HERO_ROW) + 3.4,
          ]}
          target-position={[
            COL_X0 + HERO_COL * COL_DX,
            BASE_Y + HERO_ROW * ROW_H,
            zRow(HERO_ROW),
          ]}
          angle={0.32}
          penumbra={0.5}
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
