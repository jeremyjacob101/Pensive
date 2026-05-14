import type { OptionKind } from "./schema";

export type EditValues = Record<string, string>;
export type FormType = "expense" | "incoming" | "recurring" | null;
export type UserOption = { value: string; color: string; isDefault?: boolean };
export type UserOptions = Partial<Record<OptionKind, UserOption[]>>;