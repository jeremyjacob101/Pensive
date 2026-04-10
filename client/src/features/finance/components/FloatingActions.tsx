import { PlusIcon } from "../../../components/icons";
import type { EntryType } from "../types";

type FloatingActionsProps = {
  activeComposer: EntryType | null;
  closingComposer: EntryType | null;
  currentUserExists: boolean;
  onCloseComposer: () => void;
  onOpenComposer: (type: EntryType) => void;
};

export function FloatingActions({
  activeComposer,
  closingComposer,
  currentUserExists,
  onCloseComposer,
  onOpenComposer,
}: FloatingActionsProps) {
  return (
    <nav aria-label="Quick actions" className="floating-actions">
      <button
        className={`floating-action expense ${
          activeComposer === "expense" ? "active" : ""
        } ${closingComposer === "expense" ? "returning" : ""}`}
        onClick={() =>
          currentUserExists && activeComposer === "expense"
            ? onCloseComposer()
            : onOpenComposer("expense")
        }
        type="button"
      >
        <PlusIcon />
        Expense
      </button>
      <button
        className={`floating-action income ${
          activeComposer === "income" ? "active" : ""
        } ${closingComposer === "income" ? "returning" : ""}`}
        onClick={() =>
          currentUserExists && activeComposer === "income"
            ? onCloseComposer()
            : onOpenComposer("income")
        }
        type="button"
      >
        <PlusIcon />
        Income
      </button>
    </nav>
  );
}
