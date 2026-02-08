import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useScrollContext } from '../context/ScrollContext';
import { useLayoutContext } from '../context/LayoutContext';

export interface HorizontalScrollbarProps {
  className?: string;
  style?: React.CSSProperties;
  fadeTimeout?: number;
}

export function HorizontalScrollbar({
  className,
  style,
  fadeTimeout = 1500,
}: HorizontalScrollbarProps) {
  const scroll = useScrollContext();
  const layout = useLayoutContext();
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalWidth = layout.totalWidth;
  const viewportWidth = trackRef.current?.parentElement?.clientWidth ?? 0;

  const thumbRatio = viewportWidth > 0 && totalWidth > 0
    ? Math.max(0.05, viewportWidth / totalWidth)
    : 1;
  const thumbWidth = Math.max(20, thumbRatio * viewportWidth);

  const scrollFraction = totalWidth > viewportWidth
    ? (scroll?.scrollLeft ?? 0) / (totalWidth - viewportWidth)
    : 0;
  const thumbLeft = scrollFraction * (viewportWidth - thumbWidth);

  useEffect(() => {
    setVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (!dragging) {
      fadeTimerRef.current = setTimeout(() => setVisible(false), fadeTimeout);
    }
  }, [scroll?.scrollLeft, dragging, fadeTimeout]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const track = trackRef.current;
      if (!track || !scroll) return;

      const trackRect = track.getBoundingClientRect();

      const handleMove = (moveE: PointerEvent) => {
        const relativeX = moveE.clientX - trackRect.left;
        const fraction = Math.max(0, Math.min(1, relativeX / trackRect.width));
        const target = fraction * Math.max(0, totalWidth - viewportWidth);
        scroll.scrollToX(target);
      };

      const handleUp = () => {
        setDragging(false);
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [scroll, totalWidth, viewportWidth],
  );

  if (totalWidth <= viewportWidth) return null;

  return (
    <div
      ref={trackRef}
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 8,
        opacity: visible || dragging ? 1 : 0,
        transition: 'opacity 0.2s',
        zIndex: 10,
        ...style,
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          left: thumbLeft,
          bottom: 0,
          height: 8,
          width: thumbWidth,
          borderRadius: 4,
          backgroundColor: dragging ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: dragging ? 'none' : 'background-color 0.15s',
        }}
      />
    </div>
  );
}
