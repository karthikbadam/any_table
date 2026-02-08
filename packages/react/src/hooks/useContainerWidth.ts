import { useState, useEffect, useRef, type RefObject } from 'react';

export interface ContainerMeasurements {
  width: number;
  height: number;
  rootFontSize: number;
  tableFontSize: number;
}

export function useContainerWidth(
  containerRef: RefObject<HTMLElement | null>,
): ContainerMeasurements {
  const [measurements, setMeasurements] = useState<ContainerMeasurements>({
    width: 0,
    height: 0,
    rootFontSize: 16,
    tableFontSize: 16,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const rootFs = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const tableFs = parseFloat(getComputedStyle(el).fontSize);

      setMeasurements((prev) => {
        if (
          prev.width === rect.width &&
          prev.height === rect.height &&
          prev.rootFontSize === rootFs &&
          prev.tableFontSize === tableFs
        ) {
          return prev;
        }
        return {
          width: rect.width,
          height: rect.height,
          rootFontSize: rootFs,
          tableFontSize: tableFs,
        };
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef]);

  return measurements;
}
