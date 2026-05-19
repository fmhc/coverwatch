import { useEffect } from "react";
import { useStore, type CoverSource } from "../store";

interface ManifestEntry {
  title: string;
  author?: string;
  file: string;
}
interface Manifest {
  generatedAt?: string;
  books?: ManifestEntry[];
  magazines?: ManifestEntry[];
}

/**
 * Loads the out-of-band scraped cover manifest (assets/covers/manifest.json,
 * served at /covers/manifest.json). The two built-in artworks always lead the
 * list; if the manifest is missing the app still works with just those.
 */
export function useLoadManifest() {
  const setScraped = useStore((s) => s.setScraped);
  useEffect(() => {
    let alive = true;
    fetch("/covers/manifest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: Manifest) => {
        if (!alive) return;
        const books: CoverSource[] = (m.books ?? []).map((b, i) => ({
          id: `book-${i}`,
          label: b.author ? `${b.title} — ${b.author}` : b.title,
          kind: "book",
          url: `/covers/${b.file}`,
        }));
        const mags: CoverSource[] = (m.magazines ?? []).map((b, i) => ({
          id: `mag-${i}`,
          label: b.title,
          kind: "magazine",
          url: `/covers/${b.file}`,
        }));
        setScraped([...books, ...mags]);
      })
      .catch(() => {
        /* manifest not scraped yet — built-ins + uploads only */
      });
    return () => {
      alive = false;
    };
  }, [setScraped]);
}
