import { useEffect, useRef, useState } from "react";

export function useFps(): number {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    let id: number;
    const tick = () => {
      frames.current += 1;
      const now = performance.now();
      if (now - last.current >= 1000) {
        setFps(frames.current);
        frames.current = 0;
        last.current = now;
      }
      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return fps;
}
