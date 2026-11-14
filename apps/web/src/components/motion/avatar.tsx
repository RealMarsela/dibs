import { useState } from "react";
import { hash, LetterFace } from "@/components/motion/face";
import { cn } from "@/lib/utils";

/* A face on the landing page, Hoy-style: about two in three are portraits (generated people, see
   public/faces/PROVENANCE.md), the rest are initial badges in four hues. A portrait that fails to load falls back
   to the badge, so the page never shows a broken image. */
const PHOTOS = Array.from({ length: 24 }, (_, i) => `/faces/p${String(i + 1).padStart(2, "0")}.webp`);
const HUES = ["#22d3ee", "#f43f5e", "#2dd4bf", "#facc15"]; // cyan, red, teal, yellow

/** The people the story is about keep the same face everywhere on the landing page. */
export const CAST: Record<string, string | null> = {
  maya: "/faces/maya.webp",
  leo: "/faces/p03.webp",
  ana: "/faces/p18.webp",
  priya: "/faces/p04.webp",
  sam: "/faces/p17.webp",
  tomas: "/faces/p06.webp",
  chloe: "/faces/p05.webp",
  jun: null,
  kofi: null,
};

export function Avatar({ name, seed = name, size = 40, photo, className }: { name: string; seed?: string; size?: number; photo?: string | null; className?: string }) {
  const h = hash(seed);
  const src = photo !== undefined ? photo : CAST[seed] !== undefined ? CAST[seed] : h % 3 !== 0 ? PHOTOS[h % PHOTOS.length] : null;
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full bg-white/[0.06] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <LetterFace name={name} seed={seed} size={size} color={HUES[h % HUES.length]} className={className} />;
}
