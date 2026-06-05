import { memo, useState } from "react";

const ImageWithSkeleton = memo(function ImageWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover block transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
});

export default ImageWithSkeleton;
