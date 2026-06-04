import { isScrollKey, isTypingTarget } from "../helpers/bottomSentinel";
import { useEffect, useRef } from "react";

const BOTTOM_LOAD_DISTANCE_PX = 320;
const TRIGGER_COOLDOWN_MS = 650;

export function useBottomSentinel(
  sentinelRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onIntersect: () => void,
) {
  const lastTriggerAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const maybeTrigger = (event?: Event) => {
      if (event instanceof KeyboardEvent) {
        if (!isScrollKey(event) || isTypingTarget(document.activeElement)) {
          return;
        }
      }

      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const distanceFromViewportBottom =
        sentinel.getBoundingClientRect().top - window.innerHeight;
      if (distanceFromViewportBottom > BOTTOM_LOAD_DISTANCE_PX) return;

      const now = Date.now();
      if (now - lastTriggerAtRef.current < TRIGGER_COOLDOWN_MS) return;

      lastTriggerAtRef.current = now;
      onIntersect();
    };

    window.addEventListener("scroll", maybeTrigger, { passive: true });
    window.addEventListener("wheel", maybeTrigger, { passive: true });
    window.addEventListener("touchmove", maybeTrigger, { passive: true });
    window.addEventListener("keydown", maybeTrigger);

    return () => {
      window.removeEventListener("scroll", maybeTrigger);
      window.removeEventListener("wheel", maybeTrigger);
      window.removeEventListener("touchmove", maybeTrigger);
      window.removeEventListener("keydown", maybeTrigger);
    };
  }, [enabled, onIntersect, sentinelRef]);
}