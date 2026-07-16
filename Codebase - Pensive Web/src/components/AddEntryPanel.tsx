import { buildEmptySplitExpenseDraft, buildEmptySplitIncomingDraft } from "../helpers/splitDrafts";
import { getDefaultOptionValue, getScopedOptionValues, toOptionValues } from "../helpers/options";
import { DisclosureSection, FormField, ModalActions, ModalSection } from "./EntryModal";
import type { SplitExpenseDraft, SplitIncomingDraft } from "../types/splitDrafts";
import { EMPTY_PAYBACK_DRAFT, type PaybackDraft } from "../types/paybackDraft";
import { Layers3, PencilLine, Plus, Repeat2, Trash2 } from "lucide-react";
import { getMonthFromIsoDate, getTodayIsoDate } from "../helpers/dates";
import { EffectiveAmountControls } from "./EffectiveAmountControls";
import type { FormType, UserOptions } from "../types/workspace";
import { MonthYearMultiSelect } from "./MonthYearMultiSelect";
import { randomId16, toAmount } from "../helpers/formatters";
import { SearchFieldDropdown } from "./SearchFieldDropdown";
import { PaybackDraftEditor } from "./PaybackLinkManager";
import type { Id } from "@pensive/convex-data-model";
import { useEffect, useMemo, useState } from "react";
import type { MenuItemKey } from "../types/ui";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";
import type { SyntheticEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@pensive/convex-api";
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
  onAddExpense: (
    e: SyntheticEvent<HTMLFormElement>,
  ) => Promise<Id<"expenses"> | null>;
  onAddIncoming: (
    e: SyntheticEvent<HTMLFormElement>,
  ) => Promise<Id<"incomings"> | null>;
  onAddRecurring: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  bulkCreateExpenses: (args: {
    rows: Array<{
      expense: string;
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
  const createPaybackLink = useMutation(api.paybackLinks.create);
  const todayIsoDate = getTodayIsoDate();
  const defaults = useMemo(
    () => ({
      incomeType: getDefaultOptionValue(userOptions, "incomeType"),
      account: getDefaultOptionValue(userOptions, "account"),
      category: getDefaultOptionValue(userOptions, "category"),
    }),
    [userOptions],
  );

  const [expenseAccount, setExpenseAccount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseSubcategory, setExpenseSubcategory] = useState("");
  const [incomingType, setIncomingType] = useState("");
  const [incomingSubtype, setIncomingSubtype] = useState("");
  const [incomingAccount, setIncomingAccount] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseEffectiveAmount, setExpenseEffectiveAmount] = useState("");
  const [expenseEffectiveAmountMode, setExpenseEffectiveAmountMode] = useState<
    "auto" | "manual"
  >("auto");
  const [incomingAmount, setIncomingAmount] = useState("");
  const [incomingEffectiveAmount, setIncomingEffectiveAmount] = useState("");
  const [incomingEffectiveAmountMode, setIncomingEffectiveAmountMode] =
    useState<"auto" | "manual">("auto");
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
  const [expensePaybackDraft, setExpensePaybackDraft] =
    useState<PaybackDraft>(EMPTY_PAYBACK_DRAFT);
  const [incomingPaybackDraft, setIncomingPaybackDraft] =
    useState<PaybackDraft>(EMPTY_PAYBACK_DRAFT);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [expenseBulkValues, setExpenseBulkValues] = useState({
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
    setExpenseAccount(defaults.account);
    setExpenseCategory(defaults.category);
    setExpenseSubcategory("");
    setIncomingType(defaults.incomeType);
    setIncomingSubtype("");
    setIncomingAccount(defaults.account);
    setExpenseAmount("");
    setExpenseEffectiveAmount("");
    setExpenseEffectiveAmountMode("auto");
    setIncomingAmount("");
    setIncomingEffectiveAmount("");
    setIncomingEffectiveAmountMode("auto");
    setRecurringCategory(defaults.category);
    setRecurringExpenseSubcategory("");
    setRecurringIncomingSubtype("");
    setRecurringKind("expense");
    setRecurringStatus("active");
    const month = getMonthFromIsoDate(todayIsoDate);
    setExpenseMonthYears(month ? [month] : []);
    setIncomingMonthYears(month ? [month] : []);
    setExpensePaybackDraft(EMPTY_PAYBACK_DRAFT);
    setIncomingPaybackDraft(EMPTY_PAYBACK_DRAFT);
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

  const handleAddExpenseSubmit = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
    if (
      expensePaybackDraft.candidateId &&
      !expensePaybackDraft.allocatedAmount.trim()
    ) {
      window.alert("Add an allocation amount or clear the payback selection.");
      return;
    }
    const expenseId = await onAddExpense(event);
    if (!expenseId || !expensePaybackDraft.candidateId) return;
    try {
      await createPaybackLink({
        expenseId,
        incomingId: expensePaybackDraft.candidateId as Id<"incomings">,
        allocatedAmount: toAmount(expensePaybackDraft.allocatedAmount),
        notes: expensePaybackDraft.notes.trim() || undefined,
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `Expense saved, but the payback could not be linked: ${error.message}`
          : "Expense saved, but the payback could not be linked.",
      );
    }
  };

  const handleAddIncomingSubmit = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
    if (
      incomingPaybackDraft.candidateId &&
      !incomingPaybackDraft.allocatedAmount.trim()
    ) {
      window.alert("Add an allocation amount or clear the payback selection.");
      return;
    }
    const incomingId = await onAddIncoming(event);
    if (!incomingId || !incomingPaybackDraft.candidateId) return;
    try {
      await createPaybackLink({
        expenseId: incomingPaybackDraft.candidateId as Id<"expenses">,
        incomingId,
        allocatedAmount: toAmount(incomingPaybackDraft.allocatedAmount),
        notes: incomingPaybackDraft.notes.trim() || undefined,
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `Incoming saved, but the payback could not be linked: ${error.message}`
          : "Incoming saved, but the payback could not be linked.",
      );
    }
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

  const removeSplitExpenseDraft = (index: number) => {
    setSplitExpenseDrafts((current) =>
      current.length <= 1
        ? current
        : current.filter((_, rowIndex) => rowIndex !== index));
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

  const removeSplitIncomingDraft = (index: number) => {
    setSplitIncomingDrafts((current) =>
      current.length <= 1
        ? current
        : current.filter((_, rowIndex) => rowIndex !== index));
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
  const bulkTouchedCount = Object.values(
    activeItem === "incomings" ? incomingBulkTouched : expenseBulkTouched,
  ).filter(Boolean).length;

  const applyBulkEdits = async () => {
    if (visibleCount === 0) return;

    if (activeItem === "expenses") {
      const patch: {
        account?: string;
        category?: string;
        subcategory?: string | null;
        paidTo?: string;
        notes?: string | null;
        comments?: string | null;
      } = {};

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
        (expenseBulkTouched.account && !patch.account) ||
        (expenseBulkTouched.category && !patch.category) ||
        (expenseBulkTouched.paidTo && !patch.paidTo)
      ) {
        window.alert("Account, Category, and Paid To cannot be empty.");
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
          onClick={openModalFromActiveTab}
        >
          <Plus aria-hidden="true" />
          Add {activeItem.slice(0, -1)}
        </button>
        {activeItem === "expenses" ? (
          <button
            type="button"
            className="split-entry-launcher"
            onClick={openSplitExpenseForm}
          >
            <Layers3 aria-hidden="true" />
            Split expense
          </button>
        ) : null}
        {activeItem === "incomings" ? (
          <button
            type="button"
            className="split-entry-launcher"
            onClick={openSplitIncomingForm}
          >
            <Layers3 aria-hidden="true" />
            Split incoming
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
              <PencilLine aria-hidden="true" />
              Edit visible ({visibleCount})
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
            <div
              className="modal-card bulk-edit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h3>
                    Edit {visibleCount} visible {activeItem}
                  </h3>
                  <p className="modal-subtitle">
                    Only enabled fields will change. Everything else stays
                    untouched.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkSaving}
                >
                  ✕
                </button>
              </div>
              <div className="entry-form modal-form bulk-edit-grid">
                {activeItem === "expenses" ? (
                  <>
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
                <div className="bulk-edit-summary">
                  {bulkTouchedCount === 0
                    ? "Choose the fields you want to change."
                    : `${bulkTouchedCount} field${bulkTouchedCount === 1 ? "" : "s"} will change across ${visibleCount} ${activeItem}.`}
                </div>
                <div className="bulk-edit-actions">
                  <button
                    type="button"
                    className="modal-button modal-button-secondary"
                    onClick={() => setBulkModalOpen(false)}
                    disabled={bulkSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="modal-button modal-button-primary"
                    onClick={() => void applyBulkEdits()}
                    disabled={
                      bulkSaving ||
                      visibleCount === 0 ||
                      (activeItem === "expenses"
                        ? !Object.values(expenseBulkTouched).some(Boolean)
                        : !Object.values(incomingBulkTouched).some(Boolean))
                    }
                  >
                    {bulkSaving
                      ? "Applying…"
                      : `Apply ${bulkTouchedCount || ""} change${bulkTouchedCount === 1 ? "" : "s"}`}
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
                <form
                  className="entry-modal entry-modal-standard entry-add-form"
                  onSubmit={(event) => void handleAddExpenseSubmit(event)}
                >
                  <header className="entry-modal-header">
                    <div className="entry-modal-heading">
                      <h2>Add expense</h2>
                      <p>
                        Record the purchase now; add allocation details only
                        when needed.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                      aria-label="Close add expense"
                    >
                      ✕
                    </button>
                  </header>
                  <div className="entry-modal-body">
                    <input
                      type="hidden"
                      name="monthYears"
                      value={JSON.stringify(expenseMonthYears)}
                    />
                    <ModalSection title="Details">
                      <div className="modal-form-grid">
                        <FormField
                          label="Expense name"
                          className="modal-field-wide"
                        >
                          <input
                            name="expense"
                            placeholder="e.g. Team lunch"
                            autoFocus
                            required
                          />
                        </FormField>
                        <FormField label="Amount">
                          <input
                            name="amount"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={expenseAmount}
                            onChange={(event) => {
                              const amount = event.target.value;
                              setExpenseAmount(amount);
                              if (expenseEffectiveAmountMode === "auto")
                                setExpenseEffectiveAmount(amount);
                            }}
                            required
                          />
                        </FormField>
                        <EffectiveAmountControls
                          inputName="effectiveAmount"
                          modeName="effectiveAmountMode"
                          value={expenseEffectiveAmount}
                          mode={expenseEffectiveAmountMode}
                          onChange={setExpenseEffectiveAmount}
                          onModeChange={(mode) => {
                            setExpenseEffectiveAmountMode(mode);
                            if (mode === "auto")
                              setExpenseEffectiveAmount(expenseAmount);
                          }}
                        />
                        <FormField label="Date">
                          <input
                            name="date"
                            type="date"
                            defaultValue={todayIsoDate}
                            onChange={(event) => {
                              const month = getMonthFromIsoDate(
                                event.target.value,
                              );
                              if (expenseMonthYears.length === 0 && month)
                                setExpenseMonthYears([month]);
                            }}
                            required
                          />
                        </FormField>
                        <FormField label="Paid to">
                          <input
                            name="paidTo"
                            placeholder="Person or business"
                            required
                          />
                        </FormField>
                        <FormField label="Account">
                          <OptionPicker
                            kind="account"
                            label="Account"
                            name="account"
                            value={expenseAccount}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Choose account"
                            required
                            onChange={setExpenseAccount}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Category">
                          <OptionPicker
                            kind="category"
                            label="Category"
                            name="category"
                            value={expenseCategory}
                            options={toOptionValues(userOptions?.category)}
                            placeholder="Choose category"
                            required
                            onChange={handleExpenseCategoryChange}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Subcategory" optional>
                          <OptionPicker
                            kind="subcategory"
                            label="Subcategory"
                            name="subcategory"
                            value={expenseSubcategory}
                            options={expenseSubcategoryOptions}
                            placeholder="Choose subcategory"
                            onChange={setExpenseSubcategory}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={expenseCategory}
                          />
                        </FormField>
                      </div>
                    </ModalSection>
                    <MonthYearMultiSelect
                      value={expenseMonthYears}
                      onChange={setExpenseMonthYears}
                      required
                    />
                    <PaybackDraftEditor
                      entryKind="expense"
                      value={expensePaybackDraft}
                      onChange={setExpensePaybackDraft}
                      disabled={saving}
                    />
                    <DisclosureSection
                      title="Notes & comments"
                      summary="Optional"
                    >
                      <div className="modal-form-grid">
                        <FormField label="Notes" optional>
                          <textarea
                            name="notes"
                            placeholder="Details you may want to search later"
                          />
                        </FormField>
                        <FormField label="Comments" optional>
                          <textarea
                            name="comments"
                            placeholder="Extra context"
                          />
                        </FormField>
                      </div>
                    </DisclosureSection>
                  </div>
                  <footer className="entry-modal-footer">
                    <ModalActions
                      onCancel={closeForm}
                      primaryLabel={saving ? "Adding…" : "Add expense"}
                      primaryType="submit"
                      disabled={saving}
                      secondaryAction={
                        <button
                          type="button"
                          className="modal-text-action"
                          onClick={openSplitExpenseForm}
                        >
                          <Layers3 aria-hidden="true" />
                          Create a split instead
                        </button>
                      }
                    />
                  </footer>
                </form>
              ) : (
                <div className="split-modal-layout">
                  <div className="split-modal-toolbar">
                    <div>
                      <h3>Split expense</h3>
                      <p>Create related entries and save them together.</p>
                    </div>
                    <div className="split-modal-toolbar-actions">
                      <button
                        type="button"
                        className="modal-button modal-button-primary"
                        onClick={() => void createSplitExpenses()}
                        disabled={submittingSplit || saving}
                      >
                        {submittingSplit
                          ? "Creating…"
                          : `Create ${splitExpenseDrafts.length} expense${splitExpenseDrafts.length === 1 ? "" : "s"}`}
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
                          <h3>Entry {index + 1}</h3>
                          {splitExpenseDrafts.length > 1 ? (
                            <button
                              type="button"
                              className="icon-action-btn danger"
                              aria-label={`Remove entry ${index + 1}`}
                              onClick={() => removeSplitExpenseDraft(index)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                        <div className="entry-form modal-form">
                          <FormField
                            label="Expense name"
                            className="modal-field-wide"
                          >
                            <input
                              placeholder="e.g. Team dinner"
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
                          </FormField>
                          <FormField label="Account">
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
                          </FormField>
                          <FormField label="Category">
                            <OptionPicker
                              kind="category"
                              label="Category"
                              value={draft.category}
                              options={toOptionValues(userOptions?.category)}
                              placeholder="Category"
                              required
                              onChange={(value) =>
                                updateSplitExpenseDraft(
                                  index,
                                  "category",
                                  value,
                                )
                              }
                              onCreateOption={saveOption.bind(
                                null,
                                addUserOption,
                              )}
                            />
                          </FormField>
                          <FormField label="Subcategory" optional>
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
                          </FormField>
                          <FormField label="Amount">
                            <input
                              inputMode="decimal"
                              placeholder="0.00"
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
                          </FormField>
                          <FormField label="Date">
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
                          </FormField>
                          <MonthYearMultiSelect
                            value={draft.monthYears}
                            onChange={(value) =>
                              updateSplitExpenseDraftMonthYears(index, value)
                            }
                            required
                          />
                          <FormField label="Paid to">
                            <input
                              placeholder="Person or business"
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
                          </FormField>
                          <FormField label="Notes" optional>
                            <input
                              placeholder="Extra details"
                              value={draft.notes}
                              onChange={(e) =>
                                updateSplitExpenseDraft(
                                  index,
                                  "notes",
                                  e.target.value,
                                )
                              }
                            />
                          </FormField>
                          <FormField label="Comments" optional>
                            <input
                              placeholder="Additional context"
                              value={draft.comments}
                              onChange={(e) =>
                                updateSplitExpenseDraft(
                                  index,
                                  "comments",
                                  e.target.value,
                                )
                              }
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="split-add-another"
                      onClick={addSplitExpenseDraft}
                      disabled={submittingSplit}
                    >
                      <Plus aria-hidden="true" />
                      <span>
                        <strong>Add another entry</strong>
                        <small>
                          Create one more related expense in this split.
                        </small>
                      </span>
                    </button>
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
                <form
                  className="entry-modal entry-modal-standard entry-add-form"
                  onSubmit={(event) => void handleAddIncomingSubmit(event)}
                >
                  <header className="entry-modal-header">
                    <div className="entry-modal-heading">
                      <h2>Add incoming</h2>
                      <p>
                        Record money received and link it to an expense when it
                        is a reimbursement.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                      aria-label="Close add incoming"
                    >
                      ✕
                    </button>
                  </header>
                  <div className="entry-modal-body">
                    <input
                      type="hidden"
                      name="monthYears"
                      value={JSON.stringify(incomingMonthYears)}
                    />
                    <ModalSection title="Details">
                      <div className="modal-form-grid">
                        <FormField
                          label="Incoming name"
                          className="modal-field-wide"
                        >
                          <input
                            name="incoming"
                            placeholder="e.g. Salary or dinner payback"
                            autoFocus
                            required
                          />
                        </FormField>
                        <FormField label="Amount">
                          <input
                            name="amount"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={incomingAmount}
                            onChange={(event) => {
                              const amount = event.target.value;
                              setIncomingAmount(amount);
                              if (incomingEffectiveAmountMode === "auto")
                                setIncomingEffectiveAmount(amount);
                            }}
                            required
                          />
                        </FormField>
                        <EffectiveAmountControls
                          inputName="effectiveAmount"
                          modeName="effectiveAmountMode"
                          value={incomingEffectiveAmount}
                          mode={incomingEffectiveAmountMode}
                          onChange={setIncomingEffectiveAmount}
                          onModeChange={(mode) => {
                            setIncomingEffectiveAmountMode(mode);
                            if (mode === "auto")
                              setIncomingEffectiveAmount(incomingAmount);
                          }}
                        />
                        <FormField label="Date">
                          <input
                            name="date"
                            type="date"
                            defaultValue={todayIsoDate}
                            onChange={(event) => {
                              const month = getMonthFromIsoDate(
                                event.target.value,
                              );
                              if (incomingMonthYears.length === 0 && month)
                                setIncomingMonthYears([month]);
                            }}
                            required
                          />
                        </FormField>
                        <FormField label="Paid by">
                          <input
                            name="paidBy"
                            placeholder="Person or organization"
                            required
                          />
                        </FormField>
                        <FormField label="Income type">
                          <OptionPicker
                            kind="incomeType"
                            label="Income Type"
                            name="incomeType"
                            value={incomingType}
                            options={toOptionValues(userOptions?.incomeType)}
                            placeholder="Choose income type"
                            required
                            onChange={handleIncomingTypeChange}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Income subtype" optional>
                          <OptionPicker
                            kind="incomeSubtype"
                            label="Income Subtype"
                            name="incomeSubtype"
                            value={incomingSubtype}
                            options={incomingSubtypeOptions}
                            placeholder="Choose income subtype"
                            onChange={setIncomingSubtype}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={incomingType}
                          />
                        </FormField>
                        <FormField label="Account">
                          <OptionPicker
                            kind="account"
                            label="Account"
                            name="account"
                            value={incomingAccount}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Choose account"
                            required
                            onChange={setIncomingAccount}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                      </div>
                    </ModalSection>
                    <MonthYearMultiSelect
                      value={incomingMonthYears}
                      onChange={setIncomingMonthYears}
                      required
                    />
                    <PaybackDraftEditor
                      entryKind="incoming"
                      value={incomingPaybackDraft}
                      onChange={setIncomingPaybackDraft}
                      disabled={saving}
                    />
                    <DisclosureSection
                      title="Notes & comments"
                      summary="Optional"
                    >
                      <div className="modal-form-grid">
                        <FormField label="Notes" optional>
                          <textarea
                            name="notes"
                            placeholder="Details you may want to search later"
                          />
                        </FormField>
                        <FormField label="Comments" optional>
                          <textarea
                            name="comments"
                            placeholder="Extra context"
                          />
                        </FormField>
                      </div>
                    </DisclosureSection>
                  </div>
                  <footer className="entry-modal-footer">
                    <ModalActions
                      onCancel={closeForm}
                      primaryLabel={saving ? "Adding…" : "Add incoming"}
                      primaryType="submit"
                      disabled={saving}
                      secondaryAction={
                        <button
                          type="button"
                          className="modal-text-action"
                          onClick={openSplitIncomingForm}
                        >
                          <Layers3 aria-hidden="true" />
                          Create a split instead
                        </button>
                      }
                    />
                  </footer>
                </form>
              ) : (
                <div className="split-modal-layout">
                  <div className="split-modal-toolbar">
                    <div>
                      <h3>Split incoming</h3>
                      <p>Create related entries and save them together.</p>
                    </div>
                    <div className="split-modal-toolbar-actions">
                      <button
                        type="button"
                        className="modal-button modal-button-primary"
                        onClick={() => void createSplitIncomings()}
                        disabled={submittingSplit || saving}
                      >
                        {submittingSplit
                          ? "Creating…"
                          : `Create ${splitIncomingDrafts.length} incoming${splitIncomingDrafts.length === 1 ? "" : "s"}`}
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
                          <h3>Entry {index + 1}</h3>
                          {splitIncomingDrafts.length > 1 ? (
                            <button
                              type="button"
                              className="icon-action-btn danger"
                              aria-label={`Remove entry ${index + 1}`}
                              onClick={() => removeSplitIncomingDraft(index)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                        <div className="entry-form modal-form">
                          <FormField
                            label="Incoming name"
                            className="modal-field-wide"
                          >
                            <input
                              placeholder="e.g. Shared dinner payback"
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
                          </FormField>
                          <FormField label="Paid by">
                            <input
                              placeholder="Person or organization"
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
                          </FormField>
                          <FormField label="Income type">
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
                          </FormField>
                          <FormField label="Income subtype" optional>
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
                          </FormField>
                          <FormField label="Account">
                            <OptionPicker
                              kind="account"
                              label="Account"
                              value={draft.account}
                              options={toOptionValues(userOptions?.account)}
                              placeholder="Account"
                              required
                              onChange={(value) =>
                                updateSplitIncomingDraft(
                                  index,
                                  "account",
                                  value,
                                )
                              }
                              onCreateOption={saveOption.bind(
                                null,
                                addUserOption,
                              )}
                            />
                          </FormField>
                          <FormField label="Amount">
                            <input
                              inputMode="decimal"
                              placeholder="0.00"
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
                          </FormField>
                          <FormField label="Date">
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
                          </FormField>
                          <MonthYearMultiSelect
                            value={draft.monthYears}
                            onChange={(value) =>
                              updateSplitIncomingDraftMonthYears(index, value)
                            }
                            required
                          />
                          <FormField label="Notes" optional>
                            <input
                              placeholder="Extra details"
                              value={draft.notes}
                              onChange={(e) =>
                                updateSplitIncomingDraft(
                                  index,
                                  "notes",
                                  e.target.value,
                                )
                              }
                            />
                          </FormField>
                          <FormField label="Comments" optional>
                            <input
                              placeholder="Additional context"
                              value={draft.comments}
                              onChange={(e) =>
                                updateSplitIncomingDraft(
                                  index,
                                  "comments",
                                  e.target.value,
                                )
                              }
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="split-add-another"
                      onClick={addSplitIncomingDraft}
                      disabled={submittingSplit}
                    >
                      <Plus aria-hidden="true" />
                      <span>
                        <strong>Add another entry</strong>
                        <small>
                          Create one more related incoming in this split.
                        </small>
                      </span>
                    </button>
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
            <form
              className="entry-modal entry-modal-standard recurring-add-form"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => void onAddRecurring(event)}
            >
              <header className="entry-modal-header">
                <div className="entry-modal-heading">
                  <h2>Add recurring {recurringKind}</h2>
                  <p>
                    Set the schedule once; new entries are created
                    automatically.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeForm}
                  aria-label="Close add recurring"
                >
                  ✕
                </button>
              </header>
              <div className="entry-modal-body">
                <input type="hidden" name="kind" value={recurringKind} />
                <input type="hidden" name="status" value={recurringStatus} />
                <div
                  className="recurring-kind-switch"
                  role="group"
                  aria-label="Recurring entry type"
                >
                  <button
                    type="button"
                    className={recurringKind === "expense" ? "active" : ""}
                    onClick={() => setRecurringKind("expense")}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={recurringKind === "incoming" ? "active" : ""}
                    onClick={() => setRecurringKind("incoming")}
                  >
                    Incoming
                  </button>
                </div>
                <label className="recurring-status-row">
                  <span>
                    <strong>Status</strong>
                    <small>
                      Inactive recurrings stay saved but do not create entries.
                    </small>
                  </span>
                  <span className="recurring-status-control">
                    {recurringStatus === "active" ? "Active" : "Inactive"}
                    <input
                      type="checkbox"
                      checked={recurringStatus === "active"}
                      onChange={(event) =>
                        setRecurringStatus(
                          event.target.checked ? "active" : "inactive",
                        )
                      }
                    />
                  </span>
                </label>
                <ModalSection title="Schedule">
                  <div className="modal-form-grid">
                    <FormField label="Name" className="modal-field-wide">
                      <input
                        name="name"
                        placeholder={`e.g. Monthly ${recurringKind}`}
                        autoFocus
                        required
                      />
                    </FormField>
                    <FormField label="Amount">
                      <input
                        name="amount"
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                      />
                    </FormField>
                    <FormField label="Day of month">
                      <input
                        name="dayOfMonth"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="1–31"
                        required
                      />
                    </FormField>
                  </div>
                </ModalSection>
                <ModalSection
                  title={
                    recurringKind === "expense"
                      ? "Expense details"
                      : "Incoming details"
                  }
                >
                  <div className="modal-form-grid">
                    {recurringKind === "expense" ? (
                      <>
                        <FormField label="Account">
                          <OptionPicker
                            kind="account"
                            label="Expense Account"
                            name="recurringExpenseAccount"
                            value={expenseAccount}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Choose account"
                            required
                            onChange={setExpenseAccount}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Category">
                          <OptionPicker
                            kind="category"
                            label="Expense Category"
                            name="recurringExpenseCategory"
                            value={recurringCategory}
                            options={toOptionValues(userOptions?.category)}
                            placeholder="Choose category"
                            required
                            onChange={handleRecurringCategoryChange}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Subcategory" optional>
                          <OptionPicker
                            kind="subcategory"
                            label="Expense Subcategory"
                            name="recurringExpenseSubcategory"
                            value={recurringExpenseSubcategory}
                            options={recurringExpenseSubcategoryOptions}
                            placeholder="Choose subcategory"
                            onChange={setRecurringExpenseSubcategory}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={recurringCategory}
                          />
                        </FormField>
                        <FormField label="Paid to">
                          <input
                            name="recurringExpensePaidTo"
                            placeholder="Person or business"
                            required
                          />
                        </FormField>
                      </>
                    ) : (
                      <>
                        <FormField label="Paid by">
                          <input
                            name="recurringIncomingPaidBy"
                            placeholder="Person or organization"
                            required
                          />
                        </FormField>
                        <FormField label="Income type">
                          <OptionPicker
                            kind="incomeType"
                            label="Income Type"
                            name="recurringIncomingType"
                            value={incomingType}
                            options={toOptionValues(userOptions?.incomeType)}
                            placeholder="Choose income type"
                            required
                            onChange={handleIncomingTypeChange}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                        <FormField label="Income subtype" optional>
                          <OptionPicker
                            kind="incomeSubtype"
                            label="Income Subtype"
                            name="recurringIncomingSubtype"
                            value={recurringIncomingSubtype}
                            options={recurringIncomingSubtypeOptions}
                            placeholder="Choose income subtype"
                            onChange={setRecurringIncomingSubtype}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={incomingType}
                          />
                        </FormField>
                        <FormField label="Account">
                          <OptionPicker
                            kind="account"
                            label="Incoming Account"
                            name="recurringIncomingAccount"
                            value={incomingAccount}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Choose account"
                            required
                            onChange={setIncomingAccount}
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                        </FormField>
                      </>
                    )}
                  </div>
                </ModalSection>
                <DisclosureSection title="Notes" summary="Optional">
                  <FormField label="Notes" optional>
                    <textarea
                      name="notes"
                      placeholder="Anything worth remembering"
                    />
                  </FormField>
                </DisclosureSection>
                <div className="recurring-schedule-summary">
                  <Repeat2 aria-hidden="true" />
                  Creates a new {recurringKind} on this schedule while active.
                </div>
              </div>
              <footer className="entry-modal-footer">
                <ModalActions
                  onCancel={closeForm}
                  primaryLabel={
                    saving ? "Adding…" : `Add recurring ${recurringKind}`
                  }
                  primaryType="submit"
                  disabled={saving}
                />
              </footer>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}