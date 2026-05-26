import { buildEmptySplitExpenseDraft, buildEmptySplitIncomingDraft } from "../helpers/splitDrafts";
import { getDefaultOptionValue, getScopedOptionValues, toOptionValues } from "../helpers/options";
import type { SplitExpenseDraft, SplitIncomingDraft } from "../types/splitDrafts";
import { getMonthFromIsoDate, getTodayIsoDate } from "../helpers/dates";
import type { FormType, UserOptions } from "../types/workspace";
import { MonthYearMultiSelect } from "./MonthYearMultiSelect";
import { randomId16, toAmount } from "../helpers/formatters";
import { SearchFieldDropdown } from "./SearchFieldDropdown";
import type { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MenuItemKey } from "../types/ui";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";
import type { SyntheticEvent } from "react";
import { useMutation } from "convex/react";
import { createPortal } from "react-dom";

export function AddEntryPanel({ activeItem, formType, setFormType, searchQuery, onSearchQueryChange, searchFieldOptions, selectedSearchFields, onSearchFieldsChange, visibleExpenseIds, visibleIncomingIds, visibleExpenseCategories, visibleIncomingTypes, onBulkPatchExpenses, onBulkPatchIncomings, onAddExpense, onAddIncoming, onAddRecurring, bulkCreateExpenses, bulkCreateIncomings, saving, userOptions }: {
  activeItem: MenuItemKey;
  formType: FormType;
  setFormType: (value: FormType) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchFieldOptions: Array<{ value: string; label: string }>;
  selectedSearchFields: string[];
  onSearchFieldsChange: (value: string[]) => void;
  visibleExpenseIds: string[];
  visibleIncomingIds: string[];
  visibleExpenseCategories: string[];
  visibleIncomingTypes: string[];
  onBulkPatchExpenses: (args: {
    ids: Id<"expenses">[];
    patch: {
      type?: string;
      account?: string;
      category?: string;
      subcategory?: string | null;
      paidTo?: string;
      notes?: string | null;
      comments?: string | null;
    };
  }) => Promise<{ updatedCount: number }>;
  onBulkPatchIncomings: (args: {
    ids: Id<"incomings">[];
    patch: {
      incomeType?: string;
      incomeSubtype?: string | null;
      account?: string;
      paidBy?: string;
      notes?: string | null;
      comments?: string | null;
    };
  }) => Promise<{ updatedCount: number }>;
  onAddExpense: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddIncoming: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddRecurring: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  bulkCreateExpenses: (args: {
    rows: Array<{
      expense: string;
      type: string;
      account: string;
      category: string;
      subcategory?: string;
      amount: number;
      effectiveAmount?: number;
      effectiveAmountMode?: "auto" | "manual";
      monthYears?: string[];
      date: string;
      paidTo: string;
      notes?: string;
      comments?: string;
      expenseId: string;
      baseExpenseId?: string;
      baseExpenseLabel?: string;
      subExpenseId?: string;
    }>;
  }) => Promise<unknown>;
  bulkCreateIncomings: (args: {
    rows: Array<{
      incoming: string;
      paidBy: string;
      incomeType: string;
      incomeSubtype?: string;
      account: string;
      amount: number;
      effectiveAmount?: number;
      effectiveAmountMode?: "auto" | "manual";
      monthYears?: string[];
      date: string;
      notes?: string;
      comments?: string;
      incomingId: string;
      baseIncomingId?: string;
      subIncomingId?: string;
    }>;
  }) => Promise<unknown>;
  saving: boolean;
  userOptions: UserOptions | undefined;
}) {
  const addUserOption = useMutation(api.userOptions.add);
  const todayIsoDate = getTodayIsoDate();
  const defaults = useMemo(
    () => ({
      expenseType: getDefaultOptionValue(userOptions, "expenseType"),
      incomeType: getDefaultOptionValue(userOptions, "incomeType"),
      account: getDefaultOptionValue(userOptions, "account"),
      category: getDefaultOptionValue(userOptions, "category"),
    }),
    [userOptions],
  );

  const [expenseType, setExpenseType] = useState("");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseSubcategory, setExpenseSubcategory] = useState("");
  const [incomingType, setIncomingType] = useState("");
  const [incomingSubtype, setIncomingSubtype] = useState("");
  const [incomingAccount, setIncomingAccount] = useState("");
  const [recurringCategory, setRecurringCategory] = useState("");
  const [recurringExpenseSubcategory, setRecurringExpenseSubcategory] =
    useState("");
  const [recurringIncomingSubtype, setRecurringIncomingSubtype] = useState("");
  const [recurringKind, setRecurringKind] = useState<"expense" | "incoming">(
    "expense",
  );
  const [recurringStatus, setRecurringStatus] = useState<"active" | "inactive">(
    "active",
  );

  const [splitExpenseDrafts, setSplitExpenseDrafts] = useState<
    SplitExpenseDraft[]
  >([]);
  const [splitIncomingDrafts, setSplitIncomingDrafts] = useState<
    SplitIncomingDraft[]
  >([]);
  const [submittingSplit, setSubmittingSplit] = useState(false);
  const defaultMonth = getMonthFromIsoDate(todayIsoDate);
  const [expenseMonthYears, setExpenseMonthYears] = useState<string[]>(
    defaultMonth ? [defaultMonth] : [],
  );
  const [incomingMonthYears, setIncomingMonthYears] = useState<string[]>(
    defaultMonth ? [defaultMonth] : [],
  );
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [expenseBulkValues, setExpenseBulkValues] = useState({
    type: "",
    account: "",
    category: "",
    subcategory: "",
    paidTo: "",
    notes: "",
    comments: "",
  });
  const [incomingBulkValues, setIncomingBulkValues] = useState({
    incomeType: "",
    incomeSubtype: "",
    account: "",
    paidBy: "",
    notes: "",
    comments: "",
  });
  const [expenseBulkTouched, setExpenseBulkTouched] = useState({
    type: false,
    account: false,
    category: false,
    subcategory: false,
    paidTo: false,
    notes: false,
    comments: false,
  });
  const [incomingBulkTouched, setIncomingBulkTouched] = useState({
    incomeType: false,
    incomeSubtype: false,
    account: false,
    paidBy: false,
    notes: false,
    comments: false,
  });
  const [launcherPortalTarget, setLauncherPortalTarget] =
    useState<HTMLElement | null>(() => {
      if (typeof document === "undefined") {
        return null;
      }
      if (activeItem !== "expenses" && activeItem !== "incomings") {
        return null;
      }
      return document.getElementById("entry-top-controls-anchor");
    });

  useEffect(() => {
    if (activeItem !== "expenses" && activeItem !== "incomings") {
      return;
    }

    const resolveTarget = () => {
      const target = document.getElementById("entry-top-controls-anchor");
      setLauncherPortalTarget(target);
    };

    const frame = window.requestAnimationFrame(resolveTarget);
    const observer = new MutationObserver(() => {
      const target = document.getElementById("entry-top-controls-anchor");
      if (target) {
        setLauncherPortalTarget(target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeItem]);

  const portalTargetForActiveItem =
    activeItem === "expenses" || activeItem === "incomings"
      ? launcherPortalTarget
      : null;

  const resetBulkState = () => {
    setExpenseBulkValues({
      type: "",
      account: "",
      category: "",
      subcategory: "",
      paidTo: "",
      notes: "",
      comments: "",
    });
    setIncomingBulkValues({
      incomeType: "",
      incomeSubtype: "",
      account: "",
      paidBy: "",
      notes: "",
      comments: "",
    });
    setExpenseBulkTouched({
      type: false,
      account: false,
      category: false,
      subcategory: false,
      paidTo: false,
      notes: false,
      comments: false,
    });
    setIncomingBulkTouched({
      incomeType: false,
      incomeSubtype: false,
      account: false,
      paidBy: false,
      notes: false,
      comments: false,
    });
  };

  const resetOptionState = () => {
    setExpenseType(defaults.expenseType);
    setExpenseAccount(defaults.account);
    setExpenseCategory(defaults.category);
    setExpenseSubcategory("");
    setIncomingType(defaults.incomeType);
    setIncomingSubtype("");
    setIncomingAccount(defaults.account);
    setRecurringCategory(defaults.category);
    setRecurringExpenseSubcategory("");
    setRecurringIncomingSubtype("");
    setRecurringKind("expense");
    setRecurringStatus("active");
    const month = getMonthFromIsoDate(todayIsoDate);
    setExpenseMonthYears(month ? [month] : []);
    setIncomingMonthYears(month ? [month] : []);
  };

  const openForm = (nextFormType: FormType) => {
    resetOptionState();
    setFormType(nextFormType);
  };

  const openSplitExpenseForm = () => {
    resetOptionState();
    setSplitExpenseDrafts([buildEmptySplitExpenseDraft(todayIsoDate)]);
    setSplitIncomingDrafts([]);
    setFormType("expense");
  };

  const openSplitIncomingForm = () => {
    resetOptionState();
    setSplitIncomingDrafts([buildEmptySplitIncomingDraft(todayIsoDate)]);
    setSplitExpenseDrafts([]);
    setFormType("incoming");
  };

  const closeForm = () => {
    resetOptionState();
    setSplitExpenseDrafts([]);
    setSplitIncomingDrafts([]);
    setSubmittingSplit(false);
    setFormType(null);
  };

  const isSplitExpenseMode =
    formType === "expense" && splitExpenseDrafts.length > 0;
  const isSplitIncomingMode =
    formType === "incoming" && splitIncomingDrafts.length > 0;
  const expenseSubcategoryOptions = getScopedOptionValues(
    userOptions,
    "subcategory",
    expenseCategory,
  );
  const incomingSubtypeOptions = getScopedOptionValues(
    userOptions,
    "incomeSubtype",
    incomingType,
  );
  const recurringExpenseSubcategoryOptions = getScopedOptionValues(
    userOptions,
    "subcategory",
    recurringCategory,
  );
  const recurringIncomingSubtypeOptions = getScopedOptionValues(
    userOptions,
    "incomeSubtype",
    incomingType,
  );
  const bulkExpenseSubcategoryParent = expenseBulkTouched.category
    ? expenseBulkValues.category
    : visibleExpenseCategories.length === 1
      ? visibleExpenseCategories[0]
      : "";
  const bulkIncomeSubtypeParent = incomingBulkTouched.incomeType
    ? incomingBulkValues.incomeType
    : visibleIncomingTypes.length === 1
      ? visibleIncomingTypes[0]
      : "";
  const bulkExpenseSubcategoryOptions = getScopedOptionValues(
    userOptions,
    "subcategory",
    bulkExpenseSubcategoryParent,
  );
  const bulkIncomeSubtypeOptions = getScopedOptionValues(
    userOptions,
    "incomeSubtype",
    bulkIncomeSubtypeParent,
  );

  const handleExpenseCategoryChange = (value: string) => {
    setExpenseCategory(value);
    const scopedSubcategories = getScopedOptionValues(
      userOptions,
      "subcategory",
      value,
    );
    if (expenseSubcategory && !scopedSubcategories.includes(expenseSubcategory))
      setExpenseSubcategory("");
  };

  const handleIncomingTypeChange = (value: string) => {
    setIncomingType(value);
    const scopedSubtypes = getScopedOptionValues(
      userOptions,
      "incomeSubtype",
      value,
    );
    if (incomingSubtype && !scopedSubtypes.includes(incomingSubtype))
      setIncomingSubtype("");
    if (
      recurringIncomingSubtype &&
      !scopedSubtypes.includes(recurringIncomingSubtype)
    ) {
      setRecurringIncomingSubtype("");
    }
  };

  const handleRecurringCategoryChange = (value: string) => {
    setRecurringCategory(value);
    const scopedSubcategories = getScopedOptionValues(
      userOptions,
      "subcategory",
      value,
    );
    if (
      recurringExpenseSubcategory &&
      !scopedSubcategories.includes(recurringExpenseSubcategory)
    ) {
      setRecurringExpenseSubcategory("");
    }
  };

  const updateSplitExpenseDraft = (
    index: number,
    key: keyof SplitExpenseDraft,
    value: string,
  ) => {
    setSplitExpenseDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? key === "category"
            ? { ...row, category: value, subcategory: "" }
            : { ...row, [key]: value }
          : row));
  };

  const addSplitExpenseDraft = () => {
    setSplitExpenseDrafts((current) => {
      const previous = current[current.length - 1];
      return [
        ...current,
        {
          ...buildEmptySplitExpenseDraft(todayIsoDate),
          date: previous?.date ?? todayIsoDate,
          account: previous?.account ?? "",
          paidTo: previous?.paidTo ?? "",
        },
      ];
    });
  };

  const updateSplitExpenseDraftMonthYears = (
    index: number,
    monthYears: string[],
  ) => {
    setSplitExpenseDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, monthYears } : row));
  };

  const updateSplitIncomingDraft = (
    index: number,
    key: keyof SplitIncomingDraft,
    value: string,
  ) => {
    setSplitIncomingDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? key === "incomeType"
            ? { ...row, incomeType: value, incomeSubtype: "" }
            : { ...row, [key]: value }
          : row));
  };

  const addSplitIncomingDraft = () => {
    setSplitIncomingDrafts((current) => {
      const previous = current[current.length - 1];
      return [
        ...current,
        {
          ...buildEmptySplitIncomingDraft(todayIsoDate),
          date: previous?.date ?? todayIsoDate,
          account: previous?.account ?? "",
          monthYears:
            previous?.monthYears && previous.monthYears.length > 0
              ? [...previous.monthYears]
              : buildEmptySplitIncomingDraft(todayIsoDate).monthYears,
        },
      ];
    });
  };

  const updateSplitIncomingDraftMonthYears = (
    index: number,
    monthYears: string[],
  ) => {
    setSplitIncomingDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, monthYears } : row));
  };

  const createSplitExpenses = async () => {
    const cleaned = splitExpenseDrafts.map((row) => ({
      ...row,
      expense: row.expense.trim(),
      type: row.type.trim(),
      account: row.account.trim(),
      category: row.category.trim(),
      subcategory: row.subcategory.trim(),
      paidTo: row.paidTo.trim(),
      date: row.date.trim(),
      monthYears: row.monthYears,
      notes: row.notes.trim(),
      comments: row.comments.trim(),
    }));

    const invalid = cleaned.find(
      (row) =>
        !row.expense ||
        !row.type ||
        !row.account ||
        !row.category ||
        !row.paidTo ||
        !row.date ||
        row.monthYears.length === 0 ||
        !row.amount.trim(),
    );
    if (invalid) {
      window.alert("Fill all required fields on every split expense.");
      return;
    }

    setSubmittingSplit(true);
    try {
      const baseExpenseId = randomId16();
      const baseExpenseLabel = cleaned[0]?.expense || "Split Expense";
      await bulkCreateExpenses({
        rows: cleaned.map((row, index) => ({
          expense: row.expense,
          type: row.type,
          account: row.account,
          category: row.category,
          subcategory: row.subcategory || undefined,
          amount: toAmount(row.amount),
          monthYears: row.monthYears,
          date: row.date,
          paidTo: row.paidTo,
          notes: row.notes || undefined,
          comments: row.comments || undefined,
          expenseId: randomId16(),
          baseExpenseId,
          baseExpenseLabel,
          subExpenseId: String(index + 1).padStart(3, "0"),
        })),
      });

      await Promise.all([
        ...[...new Set(cleaned.map((row) => row.type))].map((value) =>
          saveOption(addUserOption, "expenseType", value)),
        ...[...new Set(cleaned.map((row) => row.account))].map((value) =>
          saveOption(addUserOption, "account", value)),
        ...[...new Set(cleaned.map((row) => row.category))].map((value) =>
          saveOption(addUserOption, "category", value)),
        ...cleaned
          .filter((row) => row.subcategory && row.category)
          .map((row) =>
            saveOption(
              addUserOption,
              "subcategory",
              row.subcategory,
              row.category,
            )),
      ]);

      closeForm();
    } finally {
      setSubmittingSplit(false);
    }
  };

  const createSplitIncomings = async () => {
    const cleaned = splitIncomingDrafts.map((row) => ({
      ...row,
      incoming: row.incoming.trim(),
      paidBy: row.paidBy.trim(),
      incomeType: row.incomeType.trim(),
      incomeSubtype: row.incomeSubtype.trim(),
      account: row.account.trim(),
      date: row.date.trim(),
      monthYears: row.monthYears,
      notes: row.notes.trim(),
      comments: row.comments.trim(),
    }));

    const invalid = cleaned.find(
      (row) =>
        !row.incoming ||
        !row.paidBy ||
        !row.incomeType ||
        !row.account ||
        !row.date ||
        row.monthYears.length === 0 ||
        !row.amount.trim(),
    );
    if (invalid) {
      window.alert("Fill all required fields on every split incoming.");
      return;
    }

    setSubmittingSplit(true);
    try {
      const baseIncomingId = randomId16();
      await bulkCreateIncomings({
        rows: cleaned.map((row, index) => ({
          incoming: row.incoming,
          paidBy: row.paidBy,
          incomeType: row.incomeType,
          incomeSubtype: row.incomeSubtype || undefined,
          account: row.account,
          amount: toAmount(row.amount),
          date: row.date,
          monthYears: row.monthYears,
          notes: row.notes || undefined,
          comments: row.comments || undefined,
          incomingId: randomId16(),
          baseIncomingId,
          subIncomingId: String(index + 1).padStart(3, "0"),
        })),
      });

      await Promise.all([
        ...[...new Set(cleaned.map((row) => row.incomeType))].map((value) =>
          saveOption(addUserOption, "incomeType", value)),
        ...cleaned
          .filter((row) => row.incomeSubtype && row.incomeType)
          .map((row) =>
            saveOption(
              addUserOption,
              "incomeSubtype",
              row.incomeSubtype,
              row.incomeType,
            )),
        ...[...new Set(cleaned.map((row) => row.account))].map((value) =>
          saveOption(addUserOption, "account", value)),
      ]);

      closeForm();
    } finally {
      setSubmittingSplit(false);
    }
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: "expense" | "incoming" }>)
        .detail;
      const kind = detail?.kind === "incoming" ? "incoming" : "expense";
      setExpenseType(defaults.expenseType);
      setExpenseAccount(defaults.account);
      setExpenseCategory(defaults.category);
      setExpenseSubcategory("");
      setIncomingType(defaults.incomeType);
      setIncomingSubtype("");
      setIncomingAccount(defaults.account);
      setRecurringCategory(defaults.category);
      setRecurringExpenseSubcategory("");
      setRecurringIncomingSubtype("");
      setRecurringStatus("active");
      const month = getMonthFromIsoDate(todayIsoDate);
      setExpenseMonthYears(month ? [month] : []);
      setIncomingMonthYears(month ? [month] : []);
      setRecurringKind(kind);
      setFormType("recurring");
    };
    window.addEventListener("pensive:open-recurring-modal", listener);
    return () =>
      window.removeEventListener("pensive:open-recurring-modal", listener);
  }, [setFormType, defaults, todayIsoDate]);

  const openModalFromActiveTab = () => {
    if (activeItem === "expenses") {
      openForm("expense");
      return;
    }
    if (activeItem === "incomings") {
      openForm("incoming");
      return;
    }
    if (activeItem === "recurrings") {
      openForm("recurring");
    }
  };
  const visibleCount =
    activeItem === "incomings"
      ? visibleIncomingIds.length
      : visibleExpenseIds.length;

  const applyBulkEdits = async () => {
    if (visibleCount === 0) return;

    if (activeItem === "expenses") {
      const patch: {
        type?: string;
        account?: string;
        category?: string;
        subcategory?: string | null;
        paidTo?: string;
        notes?: string | null;
        comments?: string | null;
      } = {};

      if (expenseBulkTouched.type) patch.type = expenseBulkValues.type.trim();
      if (expenseBulkTouched.account)
        patch.account = expenseBulkValues.account.trim();
      if (expenseBulkTouched.category)
        patch.category = expenseBulkValues.category.trim();
      if (expenseBulkTouched.paidTo)
        patch.paidTo = expenseBulkValues.paidTo.trim();
      if (expenseBulkTouched.subcategory) {
        if (
          !expenseBulkTouched.category &&
          visibleExpenseCategories.length !== 1
        ) {
          window.alert(
            "Set Category too, or filter to one category before bulk-setting Subcategory.",
          );
          return;
        }
        patch.subcategory = expenseBulkValues.subcategory.trim() || null;
      }
      if (expenseBulkTouched.notes)
        patch.notes = expenseBulkValues.notes.trim() || null;
      if (expenseBulkTouched.comments)
        patch.comments = expenseBulkValues.comments.trim() || null;

      if (
        (expenseBulkTouched.type && !patch.type) ||
        (expenseBulkTouched.account && !patch.account) ||
        (expenseBulkTouched.category && !patch.category) ||
        (expenseBulkTouched.paidTo && !patch.paidTo)
      ) {
        window.alert("Type, Account, Category, and Paid To cannot be empty.");
        return;
      }
      if (Object.keys(patch).length === 0) return;
      const fieldList = Object.keys(patch).join(", ");
      if (
        !window.confirm(
          `Apply to ${visibleExpenseIds.length} visible expenses?\nFields: ${fieldList}`,
        )
      ) {
        return;
      }

      setBulkSaving(true);
      try {
        await onBulkPatchExpenses({
          ids: visibleExpenseIds as Id<"expenses">[],
          patch,
        });
        await Promise.all([
          patch.type
            ? saveOption(addUserOption, "expenseType", patch.type)
            : null,
          patch.account
            ? saveOption(addUserOption, "account", patch.account)
            : null,
          patch.category
            ? saveOption(addUserOption, "category", patch.category)
            : null,
          patch.subcategory
            ? saveOption(
                addUserOption,
                "subcategory",
                patch.subcategory,
                patch.category ?? bulkExpenseSubcategoryParent,
              )
            : null,
        ]);
        setBulkModalOpen(false);
        resetBulkState();
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed applying bulk expense edits.",
        );
      } finally {
        setBulkSaving(false);
      }
      return;
    }

    if (activeItem === "incomings") {
      const patch: {
        incomeType?: string;
        incomeSubtype?: string | null;
        account?: string;
        paidBy?: string;
        notes?: string | null;
        comments?: string | null;
      } = {};
      if (incomingBulkTouched.incomeType)
        patch.incomeType = incomingBulkValues.incomeType.trim();
      if (incomingBulkTouched.account)
        patch.account = incomingBulkValues.account.trim();
      if (incomingBulkTouched.paidBy)
        patch.paidBy = incomingBulkValues.paidBy.trim();
      if (incomingBulkTouched.incomeSubtype) {
        if (
          !incomingBulkTouched.incomeType &&
          visibleIncomingTypes.length !== 1
        ) {
          window.alert(
            "Set Income Type too, or filter to one income type before bulk-setting Income Subtype.",
          );
          return;
        }
        patch.incomeSubtype = incomingBulkValues.incomeSubtype.trim() || null;
      }
      if (incomingBulkTouched.notes)
        patch.notes = incomingBulkValues.notes.trim() || null;
      if (incomingBulkTouched.comments)
        patch.comments = incomingBulkValues.comments.trim() || null;
      if (
        (incomingBulkTouched.incomeType && !patch.incomeType) ||
        (incomingBulkTouched.account && !patch.account) ||
        (incomingBulkTouched.paidBy && !patch.paidBy)
      ) {
        window.alert("Income Type, Account, and Paid By cannot be empty.");
        return;
      }
      if (Object.keys(patch).length === 0) return;
      const fieldList = Object.keys(patch).join(", ");
      if (
        !window.confirm(
          `Apply to ${visibleIncomingIds.length} visible incomings?\nFields: ${fieldList}`,
        )
      ) {
        return;
      }
      setBulkSaving(true);
      try {
        await onBulkPatchIncomings({
          ids: visibleIncomingIds as Id<"incomings">[],
          patch,
        });
        await Promise.all([
          patch.incomeType
            ? saveOption(addUserOption, "incomeType", patch.incomeType)
            : null,
          patch.account
            ? saveOption(addUserOption, "account", patch.account)
            : null,
          patch.incomeSubtype
            ? saveOption(
                addUserOption,
                "incomeSubtype",
                patch.incomeSubtype,
                patch.incomeType ?? bulkIncomeSubtypeParent,
              )
            : null,
        ]);
        setBulkModalOpen(false);
        resetBulkState();
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed applying bulk incoming edits.",
        );
      } finally {
        setBulkSaving(false);
      }
    }
  };

  const launcherRow =
    activeItem !== "options" &&
    activeItem !== "recurrings" &&
    activeItem !== "breakdown" &&
    activeItem !== "tracking" &&
    activeItem !== "notepad" ? (
      <div
        className={`add-entry-launcher-row${portalTargetForActiveItem ? " docked-right" : ""}`}
      >
        <button
          type="button"
          className="add-entry-launcher"
          aria-label={`Add ${activeItem.slice(0, -1)}`}
          onClick={openModalFromActiveTab}
        >
          +
        </button>
        {activeItem === "expenses" ? (
          <button
            type="button"
            className="split-entry-launcher"
            onClick={openSplitExpenseForm}
          >
            + Split
          </button>
        ) : null}
        {activeItem === "incomings" ? (
          <button
            type="button"
            className="split-entry-launcher"
            onClick={openSplitIncomingForm}
          >
            + Split
          </button>
        ) : null}
        {activeItem === "expenses" || activeItem === "incomings" ? (
          <>
            <button
              type="button"
              className="split-entry-launcher"
              disabled={visibleCount === 0}
              onClick={() => {
                resetBulkState();
                setBulkModalOpen(true);
              }}
            >
              Edit/Apply All
            </button>
            <input
              type="search"
              className="top-row-search-input"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
            <SearchFieldDropdown
              options={searchFieldOptions}
              selected={selectedSearchFields}
              onChange={onSearchFieldsChange}
            />
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      {portalTargetForActiveItem && launcherRow
        ? createPortal(launcherRow, portalTargetForActiveItem)
        : launcherRow}

      {bulkModalOpen &&
        (activeItem === "expenses" || activeItem === "incomings") &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => {
              if (bulkSaving) return;
              setBulkModalOpen(false);
            }}
          >
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Super Edit ({visibleCount} visible)</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkSaving}
                >
                  ✕
                </button>
              </div>
              <div className="entry-form modal-form">
                {activeItem === "expenses" ? (
                  <>
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.type}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            type: e.target.checked,
                          }))
                        }
                      />
                      <span>Type</span>
                    </label>
                    <OptionPicker
                      kind="expenseType"
                      label="Expense Type"
                      value={expenseBulkValues.type}
                      options={toOptionValues(userOptions?.expenseType)}
                      placeholder="Type"
                      disabled={!expenseBulkTouched.type}
                      onChange={(value) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          type: value,
                        }))
                      }
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.account}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            account: e.target.checked,
                          }))
                        }
                      />
                      <span>Account</span>
                    </label>
                    <OptionPicker
                      kind="account"
                      label="Account"
                      value={expenseBulkValues.account}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      disabled={!expenseBulkTouched.account}
                      onChange={(value) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          account: value,
                        }))
                      }
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.category}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            category: e.target.checked,
                          }))
                        }
                      />
                      <span>Category</span>
                    </label>
                    <OptionPicker
                      kind="category"
                      label="Category"
                      value={expenseBulkValues.category}
                      options={toOptionValues(userOptions?.category)}
                      placeholder="Category"
                      disabled={!expenseBulkTouched.category}
                      onChange={(value) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          category: value,
                          subcategory: "",
                        }))
                      }
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.subcategory}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            subcategory: e.target.checked,
                          }))
                        }
                      />
                      <span>Subcategory</span>
                    </label>
                    <input
                      value={expenseBulkValues.subcategory}
                      list="bulk-expense-subcategory-options"
                      placeholder="Subcategory (can be new)"
                      disabled={!expenseBulkTouched.subcategory}
                      onChange={(e) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          subcategory: e.target.value,
                        }))
                      }
                    />
                    <datalist id="bulk-expense-subcategory-options">
                      {bulkExpenseSubcategoryOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.paidTo}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            paidTo: e.target.checked,
                          }))
                        }
                      />
                      <span>Paid To</span>
                    </label>
                    <input
                      value={expenseBulkValues.paidTo}
                      disabled={!expenseBulkTouched.paidTo}
                      onChange={(e) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          paidTo: e.target.value,
                        }))
                      }
                      placeholder="Paid To"
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.notes}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            notes: e.target.checked,
                          }))
                        }
                      />
                      <span>Notes</span>
                    </label>
                    <input
                      value={expenseBulkValues.notes}
                      disabled={!expenseBulkTouched.notes}
                      onChange={(e) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Notes (empty clears)"
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={expenseBulkTouched.comments}
                        onChange={(e) =>
                          setExpenseBulkTouched((prev) => ({
                            ...prev,
                            comments: e.target.checked,
                          }))
                        }
                      />
                      <span>Comments</span>
                    </label>
                    <input
                      value={expenseBulkValues.comments}
                      disabled={!expenseBulkTouched.comments}
                      onChange={(e) =>
                        setExpenseBulkValues((prev) => ({
                          ...prev,
                          comments: e.target.value,
                        }))
                      }
                      placeholder="Comments (empty clears)"
                    />
                  </>
                ) : (
                  <>
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.incomeType}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            incomeType: e.target.checked,
                          }))
                        }
                      />
                      <span>Income Type</span>
                    </label>
                    <OptionPicker
                      kind="incomeType"
                      label="Income Type"
                      value={incomingBulkValues.incomeType}
                      options={toOptionValues(userOptions?.incomeType)}
                      placeholder="Income Type"
                      disabled={!incomingBulkTouched.incomeType}
                      onChange={(value) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          incomeType: value,
                          incomeSubtype: "",
                        }))
                      }
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.incomeSubtype}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            incomeSubtype: e.target.checked,
                          }))
                        }
                      />
                      <span>Income Subtype</span>
                    </label>
                    <input
                      value={incomingBulkValues.incomeSubtype}
                      list="bulk-income-subtype-options"
                      placeholder="Income Subtype (can be new)"
                      disabled={!incomingBulkTouched.incomeSubtype}
                      onChange={(e) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          incomeSubtype: e.target.value,
                        }))
                      }
                    />
                    <datalist id="bulk-income-subtype-options">
                      {bulkIncomeSubtypeOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.account}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            account: e.target.checked,
                          }))
                        }
                      />
                      <span>Account</span>
                    </label>
                    <OptionPicker
                      kind="account"
                      label="Account"
                      value={incomingBulkValues.account}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      disabled={!incomingBulkTouched.account}
                      onChange={(value) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          account: value,
                        }))
                      }
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.paidBy}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            paidBy: e.target.checked,
                          }))
                        }
                      />
                      <span>Paid By</span>
                    </label>
                    <input
                      value={incomingBulkValues.paidBy}
                      disabled={!incomingBulkTouched.paidBy}
                      onChange={(e) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          paidBy: e.target.value,
                        }))
                      }
                      placeholder="Paid By"
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.notes}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            notes: e.target.checked,
                          }))
                        }
                      />
                      <span>Notes</span>
                    </label>
                    <input
                      value={incomingBulkValues.notes}
                      disabled={!incomingBulkTouched.notes}
                      onChange={(e) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Notes (empty clears)"
                    />
                    <label className="bulk-edit-toggle">
                      <input
                        type="checkbox"
                        checked={incomingBulkTouched.comments}
                        onChange={(e) =>
                          setIncomingBulkTouched((prev) => ({
                            ...prev,
                            comments: e.target.checked,
                          }))
                        }
                      />
                      <span>Comments</span>
                    </label>
                    <input
                      value={incomingBulkValues.comments}
                      disabled={!incomingBulkTouched.comments}
                      onChange={(e) =>
                        setIncomingBulkValues((prev) => ({
                          ...prev,
                          comments: e.target.value,
                        }))
                      }
                      placeholder="Comments (empty clears)"
                    />
                  </>
                )}
                <div className="bulk-edit-actions">
                  <button
                    type="button"
                    className="split-entry-launcher"
                    onClick={() => setBulkModalOpen(false)}
                    disabled={bulkSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="split-entry-launcher"
                    onClick={() => void applyBulkEdits()}
                    disabled={
                      bulkSaving ||
                      visibleCount === 0 ||
                      (activeItem === "expenses"
                        ? !Object.values(expenseBulkTouched).some(Boolean)
                        : !Object.values(incomingBulkTouched).some(Boolean))
                    }
                  >
                    {bulkSaving ? "Applying..." : "Apply"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {formType === "expense" &&
        createPortal(
          <div className="modal-overlay" onClick={closeForm}>
            <div
              className={
                isSplitExpenseMode ? "split-modal-shell" : "single-modal-shell"
              }
              onClick={(e) => e.stopPropagation()}
            >
              {!isSplitExpenseMode ? (
                <div className="modal-card">
                  <div className="modal-header">
                    <h3>Add Expense</h3>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                    >
                      ✕
                    </button>
                  </div>
                  <form
                    className="entry-form modal-form"
                    onSubmit={(e) => void onAddExpense(e)}
                  >
                    <input
                      type="hidden"
                      name="monthYears"
                      value={JSON.stringify(expenseMonthYears)}
                    />
                    <input name="expense" placeholder="Expense" required />
                    <OptionPicker
                      kind="expenseType"
                      label="Expense Type"
                      name="type"
                      value={expenseType}
                      options={toOptionValues(userOptions?.expenseType)}
                      placeholder="Type"
                      required
                      onChange={setExpenseType}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="account"
                      label="Account"
                      name="account"
                      value={expenseAccount}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      required
                      onChange={setExpenseAccount}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="category"
                      label="Category"
                      name="category"
                      value={expenseCategory}
                      options={toOptionValues(userOptions?.category)}
                      placeholder="Category"
                      required
                      onChange={handleExpenseCategoryChange}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="subcategory"
                      label="Subcategory"
                      name="subcategory"
                      value={expenseSubcategory}
                      options={expenseSubcategoryOptions}
                      placeholder="Subcategory"
                      onChange={setExpenseSubcategory}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                      parentValue={expenseCategory}
                    />
                    <input name="amount" placeholder="Amount" required />
                    <input
                      name="date"
                      type="date"
                      defaultValue={todayIsoDate}
                      onChange={(event) => {
                        const month = getMonthFromIsoDate(event.target.value);
                        if (expenseMonthYears.length === 0 && month) {
                          setExpenseMonthYears([month]);
                        }
                      }}
                      required
                    />
                    <MonthYearMultiSelect
                      value={expenseMonthYears}
                      onChange={setExpenseMonthYears}
                      required
                    />
                    <input name="paidTo" placeholder="PaidTo" required />
                    <input name="notes" placeholder="Notes" />
                    <input name="comments" placeholder="Comments" />
                    <button
                      type="submit"
                      className="save-plus-btn"
                      aria-label="Save expense"
                      disabled={saving}
                    >
                      +
                    </button>
                  </form>
                </div>
              ) : (
                <div className="split-modal-layout">
                  <div className="split-modal-toolbar">
                    <h3>Add Split Expenses</h3>
                    <div className="split-modal-toolbar-actions">
                      <button
                        type="button"
                        className="split-entry-launcher"
                        onClick={addSplitExpenseDraft}
                        disabled={submittingSplit}
                      >
                        + Split
                      </button>
                      <button
                        type="button"
                        className="save-plus-btn split-create-btn"
                        onClick={() => void createSplitExpenses()}
                        disabled={submittingSplit || saving}
                      >
                        Create All
                      </button>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={closeForm}
                        disabled={submittingSplit}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="split-modal-cards">
                    {splitExpenseDrafts.map((draft, index) => (
                      <div
                        key={`split-expense-${index}`}
                        className="modal-card split-modal-card"
                      >
                        <div className="modal-header">
                          <h3>Split #{index + 1}</h3>
                        </div>
                        <div className="entry-form modal-form">
                          <input
                            placeholder="Expense"
                            value={draft.expense}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "expense",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <OptionPicker
                            kind="expenseType"
                            label="Expense Type"
                            value={draft.type}
                            options={toOptionValues(userOptions?.expenseType)}
                            placeholder="Type"
                            required
                            onChange={(value) =>
                              updateSplitExpenseDraft(index, "type", value)
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="account"
                            label="Account"
                            value={draft.account}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Account"
                            required
                            onChange={(value) =>
                              updateSplitExpenseDraft(index, "account", value)
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="category"
                            label="Category"
                            value={draft.category}
                            options={toOptionValues(userOptions?.category)}
                            placeholder="Category"
                            required
                            onChange={(value) =>
                              updateSplitExpenseDraft(index, "category", value)
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="subcategory"
                            label="Subcategory"
                            value={draft.subcategory}
                            options={getScopedOptionValues(
                              userOptions,
                              "subcategory",
                              draft.category,
                            )}
                            placeholder="Subcategory"
                            onChange={(value) =>
                              updateSplitExpenseDraft(
                                index,
                                "subcategory",
                                value,
                              )
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={draft.category}
                          />
                          <input
                            placeholder="Amount"
                            value={draft.amount}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "amount",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "date",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <MonthYearMultiSelect
                            value={draft.monthYears}
                            onChange={(value) =>
                              updateSplitExpenseDraftMonthYears(index, value)
                            }
                            required
                          />
                          <input
                            placeholder="PaidTo"
                            value={draft.paidTo}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "paidTo",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <input
                            placeholder="Notes"
                            value={draft.notes}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "notes",
                                e.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="Comments"
                            value={draft.comments}
                            onChange={(e) =>
                              updateSplitExpenseDraft(
                                index,
                                "comments",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {formType === "incoming" &&
        createPortal(
          <div className="modal-overlay" onClick={closeForm}>
            <div
              className={
                isSplitIncomingMode ? "split-modal-shell" : "single-modal-shell"
              }
              onClick={(e) => e.stopPropagation()}
            >
              {!isSplitIncomingMode ? (
                <div className="modal-card">
                  <div className="modal-header">
                    <h3>Add Incoming</h3>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                    >
                      ✕
                    </button>
                  </div>
                  <form
                    className="entry-form modal-form"
                    onSubmit={(e) => void onAddIncoming(e)}
                  >
                    <input
                      type="hidden"
                      name="monthYears"
                      value={JSON.stringify(incomingMonthYears)}
                    />
                    <input name="incoming" placeholder="Incoming" required />
                    <input name="paidBy" placeholder="PaidBy" required />
                    <OptionPicker
                      kind="incomeType"
                      label="Income Type"
                      name="incomeType"
                      value={incomingType}
                      options={toOptionValues(userOptions?.incomeType)}
                      placeholder="IncomeType"
                      required
                      onChange={handleIncomingTypeChange}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="incomeSubtype"
                      label="Income Subtype"
                      name="incomeSubtype"
                      value={incomingSubtype}
                      options={incomingSubtypeOptions}
                      placeholder="IncomeSubtype"
                      onChange={setIncomingSubtype}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                      parentValue={incomingType}
                    />
                    <OptionPicker
                      kind="account"
                      label="Account"
                      name="account"
                      value={incomingAccount}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      required
                      onChange={setIncomingAccount}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <input name="amount" placeholder="Amount" required />
                    <input
                      name="date"
                      type="date"
                      defaultValue={todayIsoDate}
                      onChange={(event) => {
                        const month = getMonthFromIsoDate(event.target.value);
                        if (incomingMonthYears.length === 0 && month) {
                          setIncomingMonthYears([month]);
                        }
                      }}
                      required
                    />
                    <MonthYearMultiSelect
                      value={incomingMonthYears}
                      onChange={setIncomingMonthYears}
                      required
                    />
                    <input name="notes" placeholder="Notes" />
                    <input name="comments" placeholder="Comments" />
                    <button
                      type="submit"
                      className="save-plus-btn"
                      aria-label="Save incoming"
                      disabled={saving}
                    >
                      +
                    </button>
                  </form>
                </div>
              ) : (
                <div className="split-modal-layout">
                  <div className="split-modal-toolbar">
                    <h3>Add Split Incomings</h3>
                    <div className="split-modal-toolbar-actions">
                      <button
                        type="button"
                        className="split-entry-launcher"
                        onClick={addSplitIncomingDraft}
                        disabled={submittingSplit}
                      >
                        + Split
                      </button>
                      <button
                        type="button"
                        className="save-plus-btn split-create-btn"
                        onClick={() => void createSplitIncomings()}
                        disabled={submittingSplit || saving}
                      >
                        Create All
                      </button>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={closeForm}
                        disabled={submittingSplit}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="split-modal-cards">
                    {splitIncomingDrafts.map((draft, index) => (
                      <div
                        key={`split-incoming-${index}`}
                        className="modal-card split-modal-card"
                      >
                        <div className="modal-header">
                          <h3>Split #{index + 1}</h3>
                        </div>
                        <div className="entry-form modal-form">
                          <input
                            placeholder="Incoming"
                            value={draft.incoming}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "incoming",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <input
                            placeholder="PaidBy"
                            value={draft.paidBy}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "paidBy",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <OptionPicker
                            kind="incomeType"
                            label="Income Type"
                            value={draft.incomeType}
                            options={toOptionValues(userOptions?.incomeType)}
                            placeholder="IncomeType"
                            required
                            onChange={(value) =>
                              updateSplitIncomingDraft(
                                index,
                                "incomeType",
                                value,
                              )
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="incomeSubtype"
                            label="Income Subtype"
                            value={draft.incomeSubtype}
                            options={getScopedOptionValues(
                              userOptions,
                              "incomeSubtype",
                              draft.incomeType,
                            )}
                            placeholder="IncomeSubtype"
                            onChange={(value) =>
                              updateSplitIncomingDraft(
                                index,
                                "incomeSubtype",
                                value,
                              )
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={draft.incomeType}
                          />
                          <OptionPicker
                            kind="account"
                            label="Account"
                            value={draft.account}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Account"
                            required
                            onChange={(value) =>
                              updateSplitIncomingDraft(index, "account", value)
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <input
                            placeholder="Amount"
                            value={draft.amount}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "amount",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "date",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <MonthYearMultiSelect
                            value={draft.monthYears}
                            onChange={(value) =>
                              updateSplitIncomingDraftMonthYears(index, value)
                            }
                            required
                          />
                          <input
                            placeholder="Notes"
                            value={draft.notes}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "notes",
                                e.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="Comments"
                            value={draft.comments}
                            onChange={(e) =>
                              updateSplitIncomingDraft(
                                index,
                                "comments",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {formType === "recurring" &&
        createPortal(
          <div className="modal-overlay" onClick={closeForm}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Recurring</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeForm}
                >
                  ✕
                </button>
              </div>
              <form
                className="entry-form modal-form"
                onSubmit={(e) => void onAddRecurring(e)}
              >
                <label>
                  Kind
                  <select
                    name="kind"
                    value={recurringKind}
                    onChange={(e) =>
                      setRecurringKind(
                        e.target.value === "incoming" ? "incoming" : "expense",
                      )
                    }
                  >
                    <option value="expense">Expense</option>
                    <option value="incoming">Incoming</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    value={recurringStatus}
                    onChange={(e) =>
                      setRecurringStatus(
                        e.target.value === "inactive" ? "inactive" : "active",
                      )
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <input name="name" placeholder="Name" required />
                <input name="amount" placeholder="Amount" required />
                <input name="frequency" placeholder="Frequency" required />
                <input name="dayOfMonth" placeholder="Day of Month" required />
                {recurringKind === "expense" ? (
                  <>
                    <OptionPicker
                      kind="expenseType"
                      label="Expense Type"
                      name="recurringExpenseType"
                      value={expenseType}
                      options={toOptionValues(userOptions?.expenseType)}
                      placeholder="Type"
                      required
                      onChange={setExpenseType}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="account"
                      label="Expense Account"
                      name="recurringExpenseAccount"
                      value={expenseAccount}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      required
                      onChange={setExpenseAccount}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="category"
                      label="Expense Category"
                      name="recurringExpenseCategory"
                      value={recurringCategory}
                      options={toOptionValues(userOptions?.category)}
                      placeholder="Category"
                      required
                      onChange={handleRecurringCategoryChange}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="subcategory"
                      label="Expense Subcategory"
                      name="recurringExpenseSubcategory"
                      value={recurringExpenseSubcategory}
                      options={recurringExpenseSubcategoryOptions}
                      placeholder="Subcategory"
                      onChange={setRecurringExpenseSubcategory}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                      parentValue={recurringCategory}
                    />
                    <input
                      name="recurringExpensePaidTo"
                      placeholder="Paid To"
                      required
                    />
                  </>
                ) : (
                  <>
                    <input
                      name="recurringIncomingPaidBy"
                      placeholder="Paid By"
                      required
                    />
                    <OptionPicker
                      kind="incomeType"
                      label="Income Type"
                      name="recurringIncomingType"
                      value={incomingType}
                      options={toOptionValues(userOptions?.incomeType)}
                      placeholder="Income Type"
                      required
                      onChange={handleIncomingTypeChange}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                    <OptionPicker
                      kind="incomeSubtype"
                      label="Income Subtype"
                      name="recurringIncomingSubtype"
                      value={recurringIncomingSubtype}
                      options={recurringIncomingSubtypeOptions}
                      placeholder="Income Subtype"
                      onChange={setRecurringIncomingSubtype}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                      parentValue={incomingType}
                    />
                    <OptionPicker
                      kind="account"
                      label="Incoming Account"
                      name="recurringIncomingAccount"
                      value={incomingAccount}
                      options={toOptionValues(userOptions?.account)}
                      placeholder="Account"
                      required
                      onChange={setIncomingAccount}
                      onCreateOption={saveOption.bind(null, addUserOption)}
                    />
                  </>
                )}
                <input name="notes" placeholder="Notes" />
                <button
                  type="submit"
                  className="save-plus-btn"
                  aria-label="Save recurring"
                  disabled={saving}
                >
                  +
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}