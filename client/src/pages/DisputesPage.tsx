import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tradeline {
  id: string;
  creditorName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  isDerogatory: boolean;
  isDisputable: boolean;
  disputeReason: string | null;
  bureau: string;
  riskScore: number;
}

interface Dispute {
  id: string;
  tradelineId: string | null;
  bureau: string;
  disputeType: string | null;
  letterSubject: string | null;
  letterBody: string | null;
  creditorName: string | null;
  status: string;
  disclaimerAcknowledged: boolean | null;
  createdAt: string | null;
}

const BUREAU_ADDRESSES: Record<string, { name: string; address: string }> = {
  transunion: { name: "TransUnion", address: "TransUnion LLC\nP.O. Box 2000\nChester, PA 19016-2000" },
  equifax: { name: "Equifax", address: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374" },
  experian: { name: "Experian", address: "Experian\nP.O. Box 4500\nAllen, TX 75013" },
};

export default function DisputesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedLetter, setSelectedLetter] = useState<Dispute | null>(null);
  const [editBody, setEditBody] = useState("");
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: tradelines } = useQuery<Tradeline[]>({
    queryKey: ["/api/tradelines", user?.id],
    enabled: !!user,
  });

  const { data: disputes } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes", user?.id],
    enabled: !!user,
  });

  const generateDispute = useMutation({
    mutationFn: async (params: { tradelineId: string; bureau: string; creditorName: string; disputeReason: string }) => {
      // 1) Call the AI letter-generation endpoint
      const grounds = [params.disputeReason?.toLowerCase().includes("outdated") ? "outdated_info" : "inaccurate_info"];
      const genRes = await apiRequest("POST", "/api/disputes/generate", {
        userId: user?.id,
        tradelineId: params.tradelineId,
        bureau: params.bureau,
        grounds,
        round: 1,
      });
      const letter = await genRes.json();
      // 2) Save the AI-generated letter as a dispute record
      const res = await apiRequest("POST", "/api/disputes", {
        userId: user?.id,
        tradelineId: params.tradelineId,
        bureau: params.bureau,
        disputeType: letter.dispute_type || "inaccurate_info",
        letterSubject: letter.subject || `Dispute — ${params.creditorName}`,
        letterBody: letter.body,
        creditorName: params.creditorName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes", user?.id] });
      toast({ title: "AI dispute letter generated", description: "Review, personalize, and sign before mailing." });
    },
    onError: (e: any) => {
      toast({ title: "Letter generation failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const updateDispute = useMutation({
    mutationFn: async (params: { id: string; letterBody: string; disclaimerAcknowledged: boolean }) => {
      const res = await apiRequest("PATCH", `/api/disputes/${params.id}`, {
        letterBody: params.letterBody,
        disclaimerAcknowledged: params.disclaimerAcknowledged,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes", user?.id] });
      setSelectedLetter(null);
      toast({ title: "Dispute letter updated" });
    },
  });

  const disputableTradelines = tradelines?.filter((t) => t.isDisputable) ?? [];
  const existingDisputeTradelineIds = new Set(disputes?.map((d) => d.tradelineId) ?? []);

  const openLetterModal = (dispute: Dispute) => {
    setSelectedLetter(dispute);
    setEditBody(dispute.letterBody || "");
    setAck(dispute.disclaimerAcknowledged ?? false);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      {/* FCRA banner */}
      <div className="mb-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-400">FCRA Compliance Notice</p>
          <p className="text-xs text-muted-foreground mt-1">
            Under the Fair Credit Reporting Act (FCRA), you have the right to dispute inaccurate information
            on your credit report. Bureaus must investigate within 30 days. SCS generates educational templates —
            <strong className="text-foreground"> you must review, personalize, and submit letters yourself.</strong>
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-serif mb-2">Dispute Center</h1>
        <p className="text-muted-foreground">Review flagged items and manage dispute letters.</p>
      </div>

      <Tabs defaultValue="flagged">
        <TabsList className="mb-6">
          <TabsTrigger value="flagged">Flagged Items ({disputableTradelines.length})</TabsTrigger>
          <TabsTrigger value="letters">Generated Letters ({disputes?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Flagged Items */}
        <TabsContent value="flagged">
          <div className="space-y-3">
            {disputableTradelines.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No disputable items found. Upload and analyze your credit reports to identify potential disputes.</p>
                </CardContent>
              </Card>
            ) : (
              disputableTradelines.map((tl) => (
                <FlaggedItemCard
                  key={tl.id}
                  tradeline={tl}
                  hasDispute={existingDisputeTradelineIds.has(tl.id)}
                  onGenerate={(bureau) =>
                    generateDispute.mutate({
                      tradelineId: tl.id,
                      bureau,
                      creditorName: tl.creditorName,
                      disputeReason: tl.disputeReason || "Inaccurate information",
                    })
                  }
                  isGenerating={generateDispute.isPending}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Generated Letters */}
        <TabsContent value="letters">
          <div className="space-y-3">
            {!disputes || disputes.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No dispute letters generated yet. Flag items and generate letters from the Flagged Items tab.</p>
                </CardContent>
              </Card>
            ) : (
              disputes.map((d) => (
                <Card key={d.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {d.bureau}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              d.status === "draft" ? "text-primary border-primary/30" : "text-green-500 border-green-500/30"
                            }`}
                          >
                            {d.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{d.letterSubject || d.creditorName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openLetterModal(d)}>
                        View & Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Letter Modal */}
      <Dialog open={!!selectedLetter} onOpenChange={(open) => !open && setSelectedLetter(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{selectedLetter?.letterSubject}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bureau address */}
            {selectedLetter && BUREAU_ADDRESSES[selectedLetter.bureau] && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Send to:</p>
                <p className="text-sm whitespace-pre-line">{BUREAU_ADDRESSES[selectedLetter.bureau].address}</p>
              </div>
            )}

            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={16}
              className="font-mono text-xs leading-relaxed"
            />

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied!" : "Copy Letter"}
              </Button>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(!!v)} className="mt-0.5" />
              <label htmlFor="ack" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                I understand this is an educational template only. I will review, personalize, and submit this letter myself.
                SCS does not submit disputes on my behalf and makes no guarantee of results.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLetter(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedLetter &&
                updateDispute.mutate({
                  id: selectedLetter.id,
                  letterBody: editBody,
                  disclaimerAcknowledged: ack,
                })
              }
              disabled={updateDispute.isPending}
            >
              {updateDispute.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function FlaggedItemCard({
  tradeline,
  hasDispute,
  onGenerate,
  isGenerating,
}: {
  tradeline: Tradeline;
  hasDispute: boolean;
  onGenerate: (bureau: string) => void;
  isGenerating: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={`${tradeline.isDerogatory ? "border-destructive/20" : "border-border"}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-3">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{tradeline.creditorName}</p>
                {tradeline.isDerogatory && (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                    Derogatory
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tradeline.accountNumber} · {tradeline.accountType} · {tradeline.bureau}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-medium ${tradeline.riskScore >= 70 ? "text-destructive" : "text-primary"}`}>
              Risk: {tradeline.riskScore}/100
            </div>
          </div>
        </div>

        {open && (
          <div className="mt-4 pl-7 space-y-3">
            {tradeline.disputeReason && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-xs font-medium text-blue-400 mb-1">Dispute Grounds</p>
                <p className="text-xs text-muted-foreground">{tradeline.disputeReason}</p>
              </div>
            )}

            {hasDispute ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30">
                <Check className="h-3 w-3 mr-1" /> Dispute letter already generated
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerate(tradeline.bureau);
                }}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate for {tradeline.bureau.charAt(0).toUpperCase() + tradeline.bureau.slice(1)}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function generateLetterBody(bureau: string, creditorName: string, disputeReason: string): string {
  const bureauAddr = BUREAU_ADDRESSES[bureau];
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return `[YOUR FULL NAME]
[YOUR ADDRESS]
[CITY, STATE ZIP]

Date: ${date}

${bureauAddr?.address || bureau}

Re: Dispute of Inaccurate Information — ${creditorName}

To Whom It May Concern:

Pursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681i (Section 611), I am writing to dispute the following information appearing on my credit report.

Account: ${creditorName}
Reason for Dispute: ${disputeReason}

I request that this item be investigated and, if it cannot be verified within 30 days, removed from my credit report in accordance with FCRA § 611(a)(5)(A).

Please send me written confirmation of the results of your investigation.

Sincerely,
[YOUR FULL NAME]

---
DISCLAIMER: This letter was generated as an educational template by Sterling Credit Solutions. SCS does not guarantee any outcome. You must review, personalize, and submit this letter yourself.`;
}
