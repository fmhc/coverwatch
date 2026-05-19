import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import type { CoverTextureSet } from "../covers/coverTextures";
import { microRoughness } from "../lib/microDetail";

interface Props {
  tex: CoverTextureSet;
  height?: number;
  /** Page count → stack thickness. */
  pages?: number;
  /** Natural cover curl 0..1 (rack copies curl more than fresh ones). */
  curl?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Saddle-stitched glossy magazine. The cover is a subdivided plane bent into
 * a gentle curl (how a real copy sits on a rack), riding a thin page stack.
 * Gloss stock = low roughness + clearcoat, which is where the rack reflections
 * come from.
 */
export default function Magazine({
  tex,
  height = 1,
  pages = 116,
  curl = 0.5,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: Props) {
  const w = height * tex.aspect;
  const stack = Math.max(0.012, Math.min(0.07, pages * 0.0004));
  const grain = useMemo(microRoughness, []);

  const coverGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, height, 64, 8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const nx = x / (w / 2); // -1..1
      const ny = y / (height / 2);
      // gentle barrel arc + a stronger roll near the fore-edge + a touch of
      // vertical wave so it never reads as a dead-flat board
      const arc = (1 - nx * nx) * 0.022 * curl;
      const edge = Math.pow(Math.max(0, nx), 3) * 0.075 * curl;
      const wave = Math.sin(ny * 2.4) * 0.006 * curl;
      pos.setZ(i, arc + edge + wave);
    }
    g.computeVertexNormals();
    return g;
  }, [w, height, curl]);

  const pageColor = useMemo(() => new THREE.Color("#f3efe4"), []);

  return (
    <group position={position} rotation={rotation}>
      {/* Page stack */}
      <RoundedBox
        args={[w * 0.992, height * 0.992, stack]}
        radius={0.004}
        smoothness={3}
        position={[0, 0, -stack / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={pageColor} roughness={1} roughnessMap={grain} />
      </RoundedBox>

      {/* Glossy printed cover — gloss, but not a perfect mirror */}
      <mesh castShadow geometry={coverGeo} position={[0, 0, 0.001]}>
        <meshPhysicalMaterial
          map={tex.map}
          roughnessMap={tex.roughnessMap ?? grain}
          roughness={Math.min(tex.roughness, 0.34) + 0.06}
          clearcoat={Math.max(tex.clearcoat, 0.55)}
          clearcoatRoughness={Math.max(tex.clearcoatRoughness, 0.14)}
          envMapIntensity={1.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Back cover */}
      <mesh position={[0, 0, -stack - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, height]} />
        <meshPhysicalMaterial
          color={"#c9c3b3"}
          roughness={0.4}
          clearcoat={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
