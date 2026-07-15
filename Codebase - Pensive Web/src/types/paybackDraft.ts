export type PaybackDraft = {
  candidateId: string;
  allocatedAmount: string;
  notes: string;
};

export const EMPTY_PAYBACK_DRAFT: PaybackDraft = {
  candidateId: "",
  allocatedAmount: "",
  notes: "",
};
