import type { UserOption, UserOptions } from "../types/workspace";
import type { OptionKind } from "../types/schema";

const FALLBACK_COLOR = "#6B7280";

export function toOptionValues(options: UserOption[] | undefined) {
  return (options ?? []).map((option) => option.value);
}

export function getOptionColor(
  userOptions: UserOptions | undefined,
  kind: OptionKind,
  value: string,
) {
  if (!value) return FALLBACK_COLOR;
  const option = userOptions?.[kind]?.find((item) => item.value === value);
  return option?.color ?? FALLBACK_COLOR;
}

export function getScopedOptionColor(
  userOptions: UserOptions | undefined,
  kind: OptionKind,
  value: string,
  parentValue?: string,
) {
  if (!value) return FALLBACK_COLOR;
  const normalizedParent = parentValue?.trim();
  const option = userOptions?.[kind]?.find(
    (item) =>
      item.value === value &&
      (normalizedParent === undefined ||
        (item.parentValue ?? "") === normalizedParent),
  );
  return option?.color ?? getOptionColor(userOptions, kind, value);
}

export function getDefaultOptionValue(
  userOptions: UserOptions | undefined,
  kind: OptionKind,
) {
  return userOptions?.[kind]?.find((item) => item.isDefault)?.value ?? "";
}

export function getScopedOptionValues(
  userOptions: UserOptions | undefined,
  kind: OptionKind,
  parentValue: string,
) {
  const normalizedParent = parentValue.trim();
  return (userOptions?.[kind] ?? [])
    .filter((option) => (option.parentValue ?? "") === normalizedParent)
    .map((option) => option.value);
}