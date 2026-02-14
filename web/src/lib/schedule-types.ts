/**
 * Shared types for scheduled and recurring payments (used by API route and dashboard).
 */

export type OneTimeScheduleItem = {
  id: number;
  token: string;
  tokenSymbol: string;
  amount: string;
  recipient: string;
  executeAt: number;
  executed: boolean;
  cancelled: boolean;
  creationTxHash: string | null;
  executionTxHash: string | null;
};

export type RecurringScheduleItem = {
  id: number;
  token: string;
  tokenSymbol: string;
  amount: string;
  recipient: string;
  intervalSeconds: number;
  nextDueTime: number;
  endTime: number;
  cancelled: boolean;
  creationTxHash: string | null;
  executionTxHashes: string[];
};
