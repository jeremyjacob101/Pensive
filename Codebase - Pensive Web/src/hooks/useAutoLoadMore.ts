import { useEffect, useRef } from "react";

export function useAutoLoadMore(
  status: string,
  onLoadMore: () => void | Promise<void>,
) {
  const loadingRef = useRef(false);

  useEffect(() => {
    const maybeLoadMore = () => {
      if (status !== "CanLoadMore" || loadingRef.current) return;

      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      const nearBottom = scrollTop + viewportHeight >= fullHeight - 140;

      if (!nearBottom) return;

      loadingRef.current = true;
      Promise.resolve(onLoadMore()).finally(() => {
        loadingRef.current = false;
      });
    };

    const onScroll = () => {
      maybeLoadMore();
    };

    maybeLoadMore();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [status, onLoadMore]);
}