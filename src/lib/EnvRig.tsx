import { Environment, Lightformer } from "@react-three/drei";

/**
 * Studio reflection environment built entirely from Lightformers — no external
 * HDRI fetch, so reflections work offline. This is the single biggest lever on
 * the "photoreal" look: it's what gloss/clearcoat covers actually reflect.
 */
export default function EnvRig({ glam = 0.65 }: { glam?: number }) {
  return (
    <Environment resolution={256} frames={1}>
      {/* warm overhead key, like a shop ceiling strip */}
      <Lightformer
        form="rect"
        intensity={2.2 + glam * 2.4}
        color="#fff3e0"
        position={[0, 5, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[10, 6, 1]}
      />
      {/* cool rim from behind for separation */}
      <Lightformer
        form="rect"
        intensity={1.4 + glam * 1.6}
        color="#cfe5ff"
        position={[-4, 2, -5]}
        rotation={[0, Math.PI / 3, 0]}
        scale={[6, 5, 1]}
      />
      {/* soft front fill so faces aren't muddy */}
      <Lightformer
        form="rect"
        intensity={0.9 + glam}
        color="#ffffff"
        position={[3, 1, 5]}
        rotation={[0, -Math.PI / 4, 0]}
        scale={[6, 4, 1]}
      />
      {/* streak highlight that travels across glossy stock */}
      <Lightformer
        form="ring"
        intensity={2.6 * (0.4 + glam)}
        color="#ffffff"
        position={[2, 4, 3]}
        scale={[2, 2, 1]}
      />
    </Environment>
  );
}
