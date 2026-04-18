import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reads the `highlight` query param from the current URL. When present, waits
 * for the target DOM node to mount (by `data-highlight-id` attribute), scrolls
 * it into view, and applies a temporary "pulse" state the caller can render.
 *
 * Consumers should:
 *   1. Add `data-highlight-id={id}` to each row element they want addressable.
 *   2. Apply conditional styling when `highlightId === id` (e.g., indigo-50 bg).
 *
 * Respects `prefers-reduced-motion` by skipping the pulse animation duration
 * tracking — the bg class is cleared immediately on unmount of the effect.
 */
export function useHighlightRow(): {
  highlightId: string | null;
  isPulsing: boolean;
} {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const highlightId = params.get('highlight');
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (!highlightId) {
      setIsPulsing(false);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Wait a tick for the row to mount, then scroll it into view.
    let cancelled = false;
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;

    const findAndScroll = (attempt: number) => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(
        `[data-highlight-id="${CSS.escape(highlightId)}"]`,
      );
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        if (!prefersReducedMotion) {
          setIsPulsing(true);
          pulseTimer = setTimeout(() => setIsPulsing(false), 2000);
        }
        return;
      }
      if (attempt < 20) {
        setTimeout(() => findAndScroll(attempt + 1), 100);
      }
    };

    findAndScroll(0);

    return () => {
      cancelled = true;
      if (pulseTimer) clearTimeout(pulseTimer);
    };
  }, [highlightId]);

  return { highlightId, isPulsing };
}
