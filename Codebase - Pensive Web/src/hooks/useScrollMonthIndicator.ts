import { useEffect, useRef, useState } from "react";

const MONTH_ANCHOR_Y = 136;

export function useScrollMonthIndicator(
  listRef: React.RefObject<HTMLElement | null>,
  fallbackDate: string,
) {
  const [activeDate, setActiveDate] = useState(fallbackDate);
  const activeDateRef = useRef(fallbackDate);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const setNextActiveDate = (nextDate: string) => {
      if (!nextDate || nextDate === activeDateRef.current) return;

      activeDateRef.current = nextDate;
      setActiveDate(nextDate);
    };

    const updateActiveDate = () => {
      const list = listRef.current;

      if (!list) {
        setNextActiveDate(fallbackDate);
        return;
      }

      const listRect = list.getBoundingClientRect();

      document.documentElement.style.setProperty(
        "--month-row-left",
        `${listRect.left}px`,
      );

      const rows = Array.from(
        list.querySelectorAll<HTMLElement>(".entry-card[data-row-date]"),
      );

      if (rows.length === 0) {
        setNextActiveDate(fallbackDate);
        return;
      }

      let selected = rows[0];

      for (const row of rows) {
        if (row.getBoundingClientRect().top <= MONTH_ANCHOR_Y) {
          selected = row;
          continue;
        }

        break;
      }

      setNextActiveDate(selected.dataset.rowDate ?? fallbackDate);
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(updateActiveDate);
    };

    scheduleUpdate();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    if (listRef.current) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(listRef.current);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      resizeObserver?.disconnect();

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [listRef, fallbackDate]);

  return { activeDate };
}