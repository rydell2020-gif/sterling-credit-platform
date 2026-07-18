// server/lib/ai.ts
// Anthropic-backed helpers for credit analysis and dispute letter generation.
// Uses the sandbox's llm-api:website credential preset (injected via start_server).

import Anthropic from "@anthropic-ai/sdk";
import {
  CREDIT_ANALYSIS_SYSTEM,
  DISPUTE_LETTER_SYSTEM,
  buildAnalysisUserPrompt,
  buildDisputeUserPrompt,
  BUREAU_ADDRESSES,
} from "./prompts";

const client = new Anthropic();
const MODEL = "claude_sonnet_4_6";

function stripJsonFences(text: string): string {
  const cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    return cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return cleaned;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
}
export interface PriorityAction {
  title: string;
  description: string;
  timeline: string;
}
export interface RiskAssessment {
  overall_risk: "low" | "medium" | "high";
  key_concern: string;
  positive_factors: string[];
  improvement_areas: string[];
}
export interface CreditAnalysisResult {
  recommendations: Recommendation[];
  priority_actions: PriorityAction[];
  risk_assessment: RiskAssessment;
  educational_notes: string[];
}

export async function runCreditAnalysis(tradelines: any[]): Promise<CreditAnalysisResult> {
  const derog = tradelines.filter((t) => t.isDerogatory);
  const utils = tradelines
    .filter((t) => t.creditLimit && t.creditLimit > 0)
    .map((t) => (t.currentBalance || 0) / t.creditLimit);
  const utilizationAvg = utils.length ? utils.reduce((a, b) => a + b, 0) / utils.length : 0;

  const tlPayload = tradelines.map((t) => ({
    creditor: t.creditorName,
    type: t.accountType,
    status: t.accountStatus,
    balance: t.currentBalance,
    limit: t.creditLimit,
    utilization_pct: t.utilizationPct,
    payment_status: t.paymentStatus,
    age_months: t.accountAgeMonths,
    is_derogatory: t.isDerogatory,
    times_30_late: t.times30DaysLate,
    times_60_late: t.times60DaysLate,
    times_90_late: t.times90DaysLate,
    bureau: t.bureau,
  }));

  const userPrompt = buildAnalysisUserPrompt({
    tradelines: tlPayload,
    derogatoryCount: derog.length,
    utilizationAvg,
  });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: CREDIT_ANALYSIS_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const json = stripJsonFences(text);
  const parsed = JSON.parse(json) as CreditAnalysisResult;
  return parsed;
}

export interface DisputeLetterResult {
  subject: string;
  dispute_type: string;
  body: string;
}

export async function generateDisputeLetter(input: {
  bureau: "transunion" | "equifax" | "experian";
  creditor: string;
  accountNumber: string;
  round: 1 | 2 | 3;
  grounds: string[];
  reportedInfo?: Record<string, unknown>;
}): Promise<DisputeLetterResult> {
  const last4 = (input.accountNumber || "").slice(-4) || "XXXX";
  const userPrompt = buildDisputeUserPrompt({
    bureau: input.bureau,
    bureauAddress: BUREAU_ADDRESSES[input.bureau],
    creditor: input.creditor,
    accountLast4: last4,
    round: input.round,
    grounds: input.grounds,
    reportedInfo: input.reportedInfo,
  });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: DISPUTE_LETTER_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const json = stripJsonFences(text);
  const parsed = JSON.parse(json) as DisputeLetterResult;
  return parsed;
}
