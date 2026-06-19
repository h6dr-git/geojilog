import type { SavingsStep } from "@shared/incomeSources";
import type { ProfitKind } from "@shared/profitKinds";
import type { DupInfo } from "@/lib/fingerprint";

export const UNCLASSIFIED_KEY = "__unclassified__";

export const fileSig = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  sig: string;
  dup?: boolean;
  status: "analyzing" | "ready" | "error" | "duplicate";
  submitting: boolean;
  title: string;
  category: string;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  date: string;
  memo: string;
  incomeSource: string | null;
  imageUrl?: string;
  imageSig?: string;
  dupInfo?: DupInfo;
  priorDate?: string;
  nSplit?: string;
  priorUsualActual?: number;
  groupOriginal?: number;
  groupActual?: number;
  aiOriginalAmount?: number;
  aiActualAmount?: number;
  savingsSteps?: SavingsStep[];
  profitKind: ProfitKind;
  userPriceNote: string;
}
