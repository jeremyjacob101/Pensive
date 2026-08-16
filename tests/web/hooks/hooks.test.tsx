// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoLoadMore } from "../../../Codebase - Pensive Web/src/hooks/useAutoLoadMore";
import { useBottomSentinel } from "../../../Codebase - Pensive Web/src/hooks/useBottomSentinel";
import { useLocalStorage } from "../../../Codebase - Pensive Web/src/hooks/useLocalStorage";
import { useMonthScope } from "../../../Codebase - Pensive Web/src/hooks/useMonthScope";
import { useSingleMonthScope } from "../../../Codebase - Pensive Web/src/hooks/useSingleMonthScope";

describe("web hooks", () => {
  it("persists local storage state and handles a missing key", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    const { result } = renderHook(() => useLocalStorage("theme", "false"));
    expect(result.current[0]).toBe("false");
    act(() =>
      result.current[1]((previous) =>
        previous === "false" ? "true" : "false"));
    expect(result.current[0]).toBe("true");
    expect(localStorage.getItem("theme")).toBe("true");
  });

  it("navigates a bounded single-month scope and supports selected months and custom ranges", () => {
    const { result } = renderHook(() =>
      useSingleMonthScope(
        { oldestMonth: "2025-01", newestMonth: "2025-03" },
        { activeMonth: "2025-02" },
      ));
    expect(result.current.activeMonth).toBe("2025-02");
    expect(result.current.scope).toMatchObject({
      startDate: "2025-02-01",
      endDate: "2025-02-28",
      targetMonths: ["2025-02"],
    });
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(true);

    act(() => result.current.goToPreviousMonth());
    expect(result.current.activeMonth).toBe("2025-01");
    expect(result.current.canGoPrevious).toBe(false);
    act(() => result.current.goToNextMonth());
    expect(result.current.activeMonth).toBe("2025-02");
    act(() => result.current.applySelectedMonths(["2025-01", "2025-03"]));
    expect(result.current.scope).toMatchObject({
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      targetMonths: ["2025-03", "2025-01"],
    });
    act(() => result.current.applyCustomRange("2025-02-10", "2025-03-05"));
    expect(result.current.mode).toBe("custom");
    expect(result.current.scope).toMatchObject({
      startDate: "2025-02-10",
      endDate: "2025-03-05",
      targetMonths: ["2025-02", "2025-03"],
    });
  });

  it("resets multi-month scope to the newest bound and blocks appending at the oldest bound", () => {
    const { result } = renderHook(() =>
      useMonthScope({ oldestMonth: "2025-01", newestMonth: "2025-03" }));
    expect(result.current.scope.targetMonths).toEqual(["2025-03"]);
    expect(result.current.canAppendPreviousMonth).toBe(true);
    act(() => result.current.appendPreviousMonth());
    expect(result.current.scope.targetMonths).toEqual(["2025-03", "2025-02"]);
    act(() => result.current.appendPreviousMonth("2025-01"));
    expect(result.current.scope.targetMonths).toEqual([
      "2025-03",
      "2025-02",
      "2025-01",
    ]);
    expect(result.current.canAppendPreviousMonth).toBe(false);
    act(() => result.current.applyCustomRange("2025-01-15", "2025-02-05"));
    expect(result.current.mode).toBe("custom");
    expect(result.current.scope.targetMonths).toEqual(["2025-01", "2025-02"]);
    act(() => result.current.resetToNewestMonth());
    expect(result.current.mode).toBe("month");
  });

  it("auto-loads at the bottom and avoids duplicate concurrent requests", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 800,
    });
    let resolveLoad: (() => void) | undefined;
    const pendingLoad = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const onLoadMore = vi.fn().mockReturnValue(pendingLoad);
    const { rerender } = renderHook(
      ({ status }) => useAutoLoadMore(status, onLoadMore),
      {
        initialProps: { status: "CanLoadMore" },
      },
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("scroll"));
    expect(onLoadMore).toHaveBeenCalledOnce();
    resolveLoad?.();
    await act(async () => {
      await pendingLoad;
    });
    rerender({ status: "Exhausted" });
    window.dispatchEvent(new Event("resize"));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("triggers the bottom sentinel for scroll input but ignores typing keys and cooldown duplicates", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    const sentinel = document.createElement("div");
    sentinel.getBoundingClientRect = () => ({
      top: 700,
      bottom: 720,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
      x: 0,
      y: 700,
      toJSON: () => ({}),
    });
    document.body.appendChild(sentinel);
    const ref = { current: sentinel };
    const onIntersect = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    renderHook(() => useBottomSentinel(ref, true, onIntersect));
    window.dispatchEvent(new Event("scroll"));
    expect(onIntersect).toHaveBeenCalledOnce();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(onIntersect).toHaveBeenCalledOnce();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    vi.mocked(Date.now).mockReturnValue(11_000);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(onIntersect).toHaveBeenCalledOnce();
    sentinel.remove();
    vi.restoreAllMocks();
  });
});
