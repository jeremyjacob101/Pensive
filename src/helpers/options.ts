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

export function getDefaultOptionValue(
  userOptions: UserOptions | undefined,
  kind: OptionKind,
) {
  return userOptions?.[kind]?.find((item) => item.isDefault)?.value ?? "";
}