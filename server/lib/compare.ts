// server/lib/compare.ts
// Cross-bureau tradeline comparison.
// Ported from the reference implementation — groups tradelines by (fuzzy creditor + last-4 account)
// across TU/EQ/EX, then flags balance, status, credit-limit, payment-history, and missing-account
// discrepancies as potentially disputable under FCRA § 611.

export interface TradelineRow {
  id: string;
  creditorName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  currentBalance: number;
  creditLimit: number;
  paymentStatus: string;
  bureau: string;
}

export interface DiscrepancyGroup {
  creditor_name: string;
  account_number: string;
  bureaus: Record<string, Partial<TradelineRow>>;
}

export interface Discrepancy {
  userId: string;
  discrepancyType: string;
  creditorName: string;
  accountNumber: string;
  bureausAffected: string[];
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  isDisputable: boolean;
}

function normalizeCreditorName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(bank|na|corp|inc|llc|ltd|financial|services|credit|card|auto|mortgage)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupByAccount(tradelines: TradelineRow[]): DiscrepancyGroup[] {
  const groups: Record<string, DiscrepancyGroup> = {};
  for (const tl of tradelines) {
    const key = normalizeCreditorName(tl.creditorName) + "_" + (tl.accountNumber?.slice(-4) || "xxxx");
    if (!groups[key]) {
      groups[key] = {
        creditor_name: tl.creditorName,
        account_number: tl.accountNumber,
        bureaus: {},
      };
    }
    groups[key].bureaus[tl.bureau] = tl;
  }
  return Object.values(groups);
}

function detectDiscrepancies(group: DiscrepancyGroup, userId: string): Discrepancy[] {
  const bureauKeys = Object.keys(group.bureaus);
  if (bureauKeys.length < 2) return [];

  const out: Discrepancy[] = [];
  const entries = Object.entries(group.bureaus);

  // Balance mismatch (>$50)
  const balances = entries.map(([, tl]) => tl.currentBalance || 0);
  const balDiff = Math.max(...balances) - Math.min(...balances);
  if (balDiff > 50) {
    out.push({
      userId,
      discrepancyType: "balance_mismatch",
      creditorName: group.creditor_name,
      accountNumber: group.account_number,
      bureausAffected: bureauKeys,
      details: Object.fromEntries(entries.map(([b, tl]) => [b, { balance: tl.currentBalance }])),
      severity: balDiff > 500 ? "high" : "medium",
      isDisputable: true,
    });
  }

  // Status mismatch
  const statuses = [...new Set(entries.map(([, tl]) => tl.accountStatus))];
  if (statuses.length > 1) {
    const hasDerog = statuses.some((s) => ["charged_off", "collection"].includes(s || ""));
    out.push({
      userId,
      discrepancyType: "status_mismatch",
      creditorName: group.creditor_name,
      accountNumber: group.account_number,
      bureausAffected: bureauKeys,
      details: Object.fromEntries(entries.map(([b, tl]) => [b, { status: tl.accountStatus }])),
      severity: hasDerog ? "high" : "medium",
      isDisputable: true,
    });
  }

  // Credit limit mismatch (>$100)
  const limits = entries.filter(([, tl]) => tl.creditLimit && tl.creditLimit > 0);
  if (limits.length >= 2) {
    const limitValues = limits.map(([, tl]) => tl.creditLimit || 0);
    const limDiff = Math.max(...limitValues) - Math.min(...limitValues);
    if (limDiff > 100) {
      out.push({
        userId,
        discrepancyType: "limit_mismatch",
        creditorName: group.creditor_name,
        accountNumber: group.account_number,
        bureausAffected: bureauKeys,
        details: Object.fromEntries(limits.map(([b, tl]) => [b, { credit_limit: tl.creditLimit }])),
        severity: "medium",
        isDisputable: true,
      });
    }
  }

  // Payment history mismatch
  const paymentStatuses = [...new Set(entries.map(([, tl]) => tl.paymentStatus))];
  if (paymentStatuses.length > 1) {
    const hasMajorLate = paymentStatuses.some((s) => ["90_days", "120_days", "collection"].includes(s || ""));
    out.push({
      userId,
      discrepancyType: "payment_history_mismatch",
      creditorName: group.creditor_name,
      accountNumber: group.account_number,
      bureausAffected: bureauKeys,
      details: Object.fromEntries(entries.map(([b, tl]) => [b, { payment_status: tl.paymentStatus }])),
      severity: hasMajorLate ? "high" : "low",
      isDisputable: true,
    });
  }

  // Missing account (negative account absent from one bureau)
  const allBureaus = ["transunion", "equifax", "experian"];
  const missingFrom = allBureaus.filter((b) => !group.bureaus[b]);
  if (missingFrom.length > 0 && missingFrom.length < 3) {
    const isNegative = Object.values(group.bureaus).some((tl) =>
      ["charged_off", "collection"].includes(tl.accountStatus || ""),
    );
    if (isNegative) {
      out.push({
        userId,
        discrepancyType: "missing_account",
        creditorName: group.creditor_name,
        accountNumber: group.account_number,
        bureausAffected: bureauKeys,
        details: {
          present_on: bureauKeys,
          missing_from: missingFrom,
          note: "Derogatory account appears on some bureaus but not others",
        },
        severity: "medium",
        isDisputable: true,
      });
    }
  }

  return out;
}

export function compareBureaus(userId: string, tradelines: TradelineRow[]) {
  const bureausPresent = [...new Set(tradelines.map((t) => t.bureau))];
  if (bureausPresent.length < 2) {
    return {
      bureausPresent,
      accountsCompared: 0,
      discrepancies: [] as Discrepancy[],
      message: `Only ${bureausPresent.length} bureau(s) available. Upload reports from at least 2 bureaus to enable comparison.`,
    };
  }
  const groups = groupByAccount(tradelines);
  const discrepancies = groups.flatMap((g) => detectDiscrepancies(g, userId));
  return { bureausPresent, accountsCompared: groups.length, discrepancies, message: null };
}
