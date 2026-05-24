export function isScrollKey(event: KeyboardEvent) {
  return ["ArrowDown", "PageDown", "End", " "].includes(event.key);
}

export function isTypingTarget(target: Element | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
