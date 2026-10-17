import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Preview geometry only: never write viewing choices into a saved resource. */
export function fitResource(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
  gutterX = 32,
  gutterY = 32,
) {
  if (width <= 0 || height <= 0) return 1;
  return Math.max(
    0.01,
    Math.min(
      4,
      Math.max(1, availableWidth - gutterX) / width,
      Math.max(1, availableHeight - gutterY) / height,
    ),
  );
}

export function useResourceViewport<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  const [size, setSize] = useState({ width: 700, height: 420 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      const style = getComputedStyle(element);
      const width =
        element.clientWidth -
        parseFloat(style.paddingLeft || "0") -
        parseFloat(style.paddingRight || "0");
      const height =
        element.clientHeight -
        parseFloat(style.paddingTop || "0") -
        parseFloat(style.paddingBottom || "0");
      setSize((old) =>
        old.width === width && old.height === height ? old : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function useResourceFit(
  width: number,
  height: number,
  zoom: number,
  gutterX: number | ((width: number) => number) = 32,
  gutterY: number | ((width: number) => number) = 32,
) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useResourceViewport(ref);
  return {
    ref,
    ...size,
    scale:
      zoom ||
      fitResource(
        width,
        height,
        size.width,
        size.height,
        typeof gutterX === "function" ? gutterX(size.width) : gutterX,
        typeof gutterY === "function" ? gutterY(size.width) : gutterY,
      ),
  };
}
