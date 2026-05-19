import { ReactNode, useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useScrapedTextures, type BgCover } from "../covers/useScrapedTextures";
import { useStore } from "../store";

const HERO_STANDER = 3; // centre slot on the back riser (used in-situ)

const WOOD = new THREE.MeshPhysicalMaterial({
  color: "#6b4426",
  roughness: 0.5,
  clearcoat: 0.4,
  clearcoatRoughness: 0.45,
  sheen: 0.3,
  sheenColor: new THREE.Color("#caa06a"),
});
const SPINE = new THREE.MeshStandardMaterial({ color: "#2a2622", roughness: 0.82 });
const TABLE_H = 0.95;

function topperTexture() {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#c01717";
  x.fillRect(0, 0, 768, 256);
  x.fillStyle = "#ffd23f";
  x.fillRect(0, 0, 768, 14);
  x.fillRect(0, 242, 768, 14);
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.font = "800 86px Inter, sans-serif";
  x.fillText("BESTSELLER", 384, 110);
  x.font = "700 44px Inter, sans-serif";
  x.fillText("NEU & REDUZIERT · −30%", 384, 180);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A loose face-up pile of real books — varied counts, heights and yaw. */
function Stack({
  covers,
  at,
  yaw,
}: {
  covers: BgCover[];
  at: [number, number];
  yaw: number;
}) {
  let y = 0;
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      {covers.map((c, i) => {
        const h = 0.62 + (i % 2) * 0.05;
        const w = h * c.aspect;
        const d = 0.04 + ((i * 7) % 3) * 0.012;
        const yo = y + d / 2;
        y += d;
        const face = new THREE.MeshPhysicalMaterial({
          map: c.tex,
          roughness: 0.52,
          clearcoat: 0.35,
          clearcoatRoughness: 0.3,
        });
        const mats = [SPINE, SPINE, face, SPINE, SPINE, SPINE];
        return (
          <mesh
            key={i}
            position={[((i * 13) % 5) * 0.01, yo, ((i * 17) % 5) * 0.01]}
            rotation={[0, (((i * 23) % 7) - 3) * 0.03, 0]}
            material={mats}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[w, d, h]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A book stood face-out on the back riser. */
function StandUp({ cover, p, ry }: { cover: BgCover; p: [number, number, number]; ry: number }) {
  const h = 0.7;
  const w = h * cover.aspect;
  const face = new THREE.MeshPhysicalMaterial({
    map: cover.tex,
    roughness: 0.5,
    clearcoat: 0.4,
    clearcoatRoughness: 0.28,
  });
  const mats = [SPINE, SPINE, SPINE, SPINE, face, SPINE];
  return (
    <mesh position={p} rotation={[0, ry, 0]} material={mats} castShadow receiveShadow>
      <boxGeometry args={[w, h, 0.06]} />
    </mesh>
  );
}

/**
 * Bookshop **bargain / dump table**: a real waist-height table (top + apron +
 * legs) on a tiled, faintly reflective shop floor, a stepped riser at the back
 * carrying face-out copies under a red "BESTSELLER −30%" topper, and the
 * tabletop strewn with loose face-up stacks of real books — the hero copy
 * raised on a small clear riser at the front so it owns the table.
 */
export default function BookshopTable({ children }: { children: ReactNode }) {
  const bg = useScrapedTextures("book", 30);
  const topper = useMemo(topperTexture, []);
  const placement = useStore((s) => s.placement);

  // Loose stacks, but never inside the front-centre zone where the hero copy
  // (plinth in highlight) sits — that was the interpenetration.
  const stacks = useMemo(
    () =>
      Array.from({ length: 11 })
        .map((_, i) => ({
          at: [
            -1.2 + (i % 3) * 1.15 + (Math.random() - 0.5) * 0.22,
            -0.2 + Math.floor(i / 3) * 0.42 + (Math.random() - 0.5) * 0.14,
          ] as [number, number],
          yaw: (Math.random() - 0.5) * 1.0,
          n: 1 + Math.floor(Math.random() * 5),
        }))
        .filter((s) => !(Math.abs(s.at[0]) < 0.62 && s.at[1] > 0.18)),
    [],
  );
  const standers = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        p: [-1.4 + i * 0.47, 0.62, -1.05] as [number, number, number],
        ry: (Math.random() - 0.5) * 0.25,
      })),
    [],
  );

  return (
    <group>
      {/* tiled shop floor with a soft reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TABLE_H, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial
          color={"#23211f"}
          roughness={0.65}
          metalness={0.1}
          resolution={1024}
          mirror={0.3}
          mixStrength={1}
          mixBlur={1.2}
          blur={[480, 160]}
          depthScale={1}
        />
      </mesh>

      {/* blurred shelf wall for depth */}
      <mesh position={[0, 1.0, -3.4]}>
        <planeGeometry args={[40, 9]} />
        <meshStandardMaterial color={"#171210"} roughness={1} />
      </mesh>

      {/* ---- the table ---- */}
      <mesh position={[0, -0.03, 0]} castShadow receiveShadow material={WOOD}>
        <boxGeometry args={[3.3, 0.06, 1.9]} />
      </mesh>
      {/* apron */}
      <mesh position={[0, -0.16, 0.9]} material={WOOD}>
        <boxGeometry args={[3.3, 0.2, 0.06]} />
      </mesh>
      <mesh position={[0, -0.16, -0.9]} material={WOOD}>
        <boxGeometry args={[3.3, 0.2, 0.06]} />
      </mesh>
      {/* legs */}
      {[
        [-1.55, -0.85],
        [1.55, -0.85],
        [-1.55, 0.85],
        [1.55, 0.85],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -TABLE_H / 2 - 0.05, z]} material={WOOD} castShadow>
          <boxGeometry args={[0.08, TABLE_H - 0.05, 0.08]} />
        </mesh>
      ))}

      {/* back stepped riser */}
      <mesh position={[0, 0.16, -1.0]} material={WOOD} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.32, 0.45]} />
      </mesh>

      {/* topper sign on a post */}
      <mesh position={[0, 0.66, -1.28]} castShadow>
        <boxGeometry args={[1.25, 0.42, 0.02]} />
        <meshStandardMaterial map={topper} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.42, -1.28]}>
        <boxGeometry args={[0.03, 0.5, 0.03]} />
        <meshStandardMaterial color={"#111"} />
      </mesh>

      {/* real books: face-out on the riser + loose face-up stacks. In-situ
          mode frees the centre riser slot for the hero copy. */}
      {bg.length > 0 &&
        standers.map((s, i) =>
          placement === "insitu" && i === HERO_STANDER ? null : (
            <StandUp key={`s${i}`} cover={bg[i % bg.length]} p={s.p} ry={s.ry} />
          ),
        )}
      {bg.length > 0 &&
        stacks.map((st, i) => (
          <Stack
            key={`p${i}`}
            covers={Array.from({ length: st.n }).map(
              (_, k) => bg[(i * 5 + k + 3) % bg.length],
            )}
            at={st.at}
            yaw={st.yaw}
          />
        ))}

      {/* hard track key (crisp directional shadow) + warm fill */}
      <spotLight
        position={[2.4, 3.8, 2.2]}
        angle={0.55}
        penumbra={0.35}
        intensity={42}
        color={"#fff0d8"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00015}
      />
      <directionalLight
        position={[1.6, 4.2, 1.2]}
        intensity={1.1}
        color={"#ffe9cf"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      <spotLight
        position={[-2.2, 3.0, 1.4]}
        angle={0.7}
        penumbra={0.9}
        intensity={9}
        color={"#ffe6c4"}
      />

      {/* tighter, darker contact shadow — less floaty */}
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.9}
        scale={5}
        blur={1.4}
        far={1.6}
        resolution={1024}
      />

      {/* HERO. highlight: raised on a matte plinth at the front, leaning to
          the aisle. insitu: a normal face-out copy in the centre riser slot,
          flush among the competing covers — the real sales situation. */}
      {placement === "highlight" ? (
        <>
          <mesh position={[0, 0.03, 0.55]} castShadow receiveShadow material={WOOD}>
            <boxGeometry args={[0.74, 0.06, 0.44]} />
          </mesh>
          <group position={[0, 0.55, 0.55]} rotation={[-0.18, 0, 0]}>
            {children}
          </group>
        </>
      ) : (
        <group
          position={[standers[HERO_STANDER].p[0], 0.8, standers[HERO_STANDER].p[2]]}
          rotation={[0, standers[HERO_STANDER].ry, 0]}
        >
          {children}
        </group>
      )}
    </group>
  );
}
