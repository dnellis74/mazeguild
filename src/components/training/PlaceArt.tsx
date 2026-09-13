import { placeImageSrc } from "@/training/placeImage";

/** Plain square place image — same treatment wherever a location has art. */
export function PlaceArt({
  name,
  className = "",
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const src = placeImageSrc(name);
  if (!src) return null;
  return (
    <img
      className={`place-art${className ? ` ${className}` : ""}`}
      src={src}
      alt=""
      decoding="async"
    />
  );
}
