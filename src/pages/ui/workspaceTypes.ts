import type { Dispatch, SetStateAction } from "react";

export type EditValues = Record<string, string>;

export type SetEditValues = Dispatch<SetStateAction<EditValues>>;
