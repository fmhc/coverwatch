import { create } from "zustand";

export type SceneId = "bookshop" | "rack";
export type ProductKind = "book" | "magazine";
export type FinishId = "matte" | "gloss" | "softtouch" | "spotuv";
/** "highlight" = pulled forward + spotlit; "insitu" = a normal copy sitting
 *  among the competing covers, exactly as it looks in the shop. */
export type Placement = "highlight" | "insitu";

export interface CoverSource {
  id: string;
  label: string;
  kind: ProductKind;
  /** "builtin" = procedural; data URL = user upload; otherwise an image URL. */
  url: string | "builtin";
  /** True for covers the user uploaded (persisted in localStorage). */
  uploaded?: boolean;
}

const LS_KEY = "coverwatch.uploads.v1";

function loadUploads(): CoverSource[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CoverSource[];
    return Array.isArray(arr) ? arr.filter((c) => c.url && c.id) : [];
  } catch {
    return [];
  }
}

function saveUploads(u: CoverSource[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(u));
  } catch {
    /* quota / private mode — uploads just won't persist */
  }
}

interface State {
  scene: SceneId;
  product: ProductKind;
  coverId: string;
  finish: FinishId;
  placement: Placement;
  /** Cosmetic intensity of the post-processing "studio" look 0..1. */
  glam: number;
  /** ACES tone-mapping exposure; tunable by the AI realism pass. */
  exposure: number;
  cameraPreset: number;
  /** Bumped to force the camera rig to re-fly to the current preset. */
  viewNonce: number;
  autoSpin: boolean;
  /** Built-ins + uploads + scraped, in that priority order. */
  covers: CoverSource[];
  uploads: CoverSource[];
  scraped: CoverSource[];
  /** Last AI realism critique, shown in the UI. */
  aiNotes: string;
  aiBusy: boolean;
  setExposure: (e: number) => void;
  setAi: (notes: string, busy: boolean) => void;
  setScene: (s: SceneId) => void;
  setProduct: (p: ProductKind) => void;
  setCover: (id: string) => void;
  setFinish: (f: FinishId) => void;
  setPlacement: (p: Placement) => void;
  setGlam: (g: number) => void;
  cyclePreset: (count: number) => void;
  setPreset: (i: number) => void;
  resetView: () => void;
  toggleSpin: () => void;
  setScraped: (c: CoverSource[]) => void;
  addUpload: (c: CoverSource) => void;
  removeUpload: (id: string) => void;
}

export const BUILTIN_COVERS: CoverSource[] = [
  { id: "ki-frisst-alles", label: "KI frisst alles auf — Finn", kind: "book", url: "builtin" },
  { id: "angelmagazin", label: "Angelmagazin 06/26", kind: "magazine", url: "builtin" },
];

const compose = (uploads: CoverSource[], scraped: CoverSource[]) => [
  ...BUILTIN_COVERS,
  ...uploads,
  ...scraped,
];

const initialUploads = loadUploads();

export const useStore = create<State>((set) => ({
  scene: "bookshop",
  product: "book",
  coverId: "ki-frisst-alles",
  finish: "spotuv",
  placement: "highlight",
  glam: 0.65,
  exposure: 1.28,
  cameraPreset: 0,
  viewNonce: 0,
  autoSpin: false,
  uploads: initialUploads,
  scraped: [],
  covers: compose(initialUploads, []),
  aiNotes: "",
  aiBusy: false,
  setExposure: (exposure) => set({ exposure }),
  setAi: (aiNotes, aiBusy) => set({ aiNotes, aiBusy }),
  setScene: (scene) => set({ scene }),
  setProduct: (product) =>
    set((s) => {
      const match = s.covers.find((c) => c.kind === product);
      return { product, coverId: match ? match.id : s.coverId };
    }),
  setCover: (coverId) =>
    set((s) => {
      const c = s.covers.find((x) => x.id === coverId);
      return c ? { coverId, product: c.kind } : { coverId };
    }),
  setFinish: (finish) => set({ finish }),
  setPlacement: (placement) => set({ placement }),
  setGlam: (glam) => set({ glam }),
  cyclePreset: (count) =>
    set((s) => ({
      cameraPreset: (s.cameraPreset + 1) % Math.max(1, count),
      viewNonce: s.viewNonce + 1,
    })),
  setPreset: (i) => set((s) => ({ cameraPreset: i, viewNonce: s.viewNonce + 1 })),
  resetView: () => set((s) => ({ viewNonce: s.viewNonce + 1 })),
  toggleSpin: () => set((s) => ({ autoSpin: !s.autoSpin })),
  setScraped: (scraped) =>
    set((s) => ({ scraped, covers: compose(s.uploads, scraped) })),
  addUpload: (c) =>
    set((s) => {
      const uploads = [c, ...s.uploads.filter((u) => u.id !== c.id)];
      saveUploads(uploads);
      return {
        uploads,
        covers: compose(uploads, s.scraped),
        coverId: c.id,
        product: c.kind,
      };
    }),
  removeUpload: (id) =>
    set((s) => {
      const uploads = s.uploads.filter((u) => u.id !== id);
      saveUploads(uploads);
      const covers = compose(uploads, s.scraped);
      const coverId =
        s.coverId === id ? BUILTIN_COVERS[0].id : s.coverId;
      return { uploads, covers, coverId };
    }),
}));
