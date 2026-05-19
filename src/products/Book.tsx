import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import type { CoverTextureSet } from "../covers/coverTextures";
import { microRoughness } from "../lib/microDetail";

interface Props {
  tex: CoverTextureSet;
  /** Trim height in world units; width derives from the artwork aspect. */
  height?: number;
  /** Number of printed pages → spine thickness. */
  pages?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Parametric casebound hardcover: cream page block wrapped by softly bevelled
 * printed boards with a square spine. Edges are rounded (RoundedBox) and a
 * shared micro-roughness map breaks the plastic uniformity — the two biggest
 * "this is a render" tells called out by the AI realism pass.
 */
export default function Book({
  tex,
  height = 1,
  pages = 320,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: Props) {
  const w = height * tex.aspect;
  const block = useMemo(
    () => Math.max(0.05, Math.min(0.26, pages * 0.0006)),
    [pages],
  );
  const board = 0.02;
  const depth = block + board * 2;
  const grain = useMemo(microRoughness, []);

  const coverColor = useMemo(() => new THREE.Color("#14161b"), []);
  const pageColor = useMemo(() => new THREE.Color("#efe9da"), []);

  return (
    <group position={position} rotation={rotation}>
      {/* Page block */}
      <RoundedBox
        args={[w * 0.965, height * 0.975, block]}
        radius={0.006}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={pageColor}
          roughness={1}
          roughnessMap={grain}
        />
      </RoundedBox>

      {/* Front cover board (cloth) */}
      <RoundedBox
        args={[w, height, board]}
        radius={0.01}
        smoothness={4}
        position={[0, 0, depth / 2 - board / 2]}
        castShadow
      >
        <meshPhysicalMaterial
          color={coverColor}
          roughness={0.72}
          roughnessMap={grain}
          clearcoat={0.15}
          clearcoatRoughness={0.6}
        />
      </RoundedBox>

      {/* Printed artwork, inset so the bevelled board edge stays visible */}
      <mesh position={[0, 0, depth / 2 + 0.0015]}>
        <planeGeometry args={[w * 0.99, height * 0.99]} />
        <meshPhysicalMaterial
          map={tex.map}
          roughnessMap={tex.roughnessMap ?? grain}
          roughness={tex.roughness}
          clearcoat={tex.clearcoat}
          clearcoatRoughness={tex.clearcoatRoughness}
          envMapIntensity={1.05}
        />
      </mesh>

      {/* Back board */}
      <RoundedBox
        args={[w, height, board]}
        radius={0.01}
        smoothness={4}
        position={[0, 0, -(depth / 2 - board / 2)]}
        castShadow
      >
        <meshPhysicalMaterial
          color={coverColor}
          roughness={0.66}
          roughnessMap={grain}
          clearcoat={0.12}
        />
      </RoundedBox>

      {/* Spine */}
      <RoundedBox
        args={[board, height, depth]}
        radius={0.008}
        smoothness={4}
        position={[-w / 2 - board / 2, 0, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color={coverColor}
          roughness={0.6}
          roughnessMap={grain}
          clearcoat={0.15}
        />
      </RoundedBox>

      {/* Fore-edge cap so the page block doesn't read as a raw box */}
      <mesh position={[w / 2 - w * 0.0175, 0, 0]}>
        <boxGeometry args={[0.004, height * 0.975, block]} />
        <meshStandardMaterial color={"#e7e0cf"} roughness={1} roughnessMap={grain} />
      </mesh>
    </group>
  );
}
