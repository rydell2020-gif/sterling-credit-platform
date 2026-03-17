import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Shield, Upload, CheckCircle, XCircle, Loader2, HelpCircle } from "lucide-react";

const BUREAUS = [
  { key: "transunion", label: "TransUnion", color: "bg-blue-600", abbr: "TU" },
  { key: "equifax", label: "Equifax", color: "bg-red-600", abbr: "EQ" },
  { key: "experian", label: "Experian", color: "bg-indigo-600", abbr: "EX" },
];

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface BureauState {
  file: File | null;
  status: UploadStatus;
  error: string | null;
}

function UploadDisclosure({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Card className="max-w-2xl mx-auto border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle className="font-serif text-xl">Before You Upload — Important Notice</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">By uploading your credit report(s), you acknowledge the following:</p>
        <ul className="space-y-3 text-sm text-muted-foreground">
          {[
            { title: "Educational Use Only", desc: "Sterling Credit Solutions provides educational tools. We do not provide legal or financial advice." },
            { title: "No Guaranteed Results", desc: "We make no guarantee that credit scores will increase or that any information will be removed from your report." },
            { title: "You Control All Actions", desc: "We will never submit dispute letters or take actions on your behalf. All submissions are made by you." },
            { title: "Data Security", desc: "Your files are stored in a private, encrypted storage bucket accessible only to your account." },
            { title: "Texas CSO Notice", desc: "Sterling Credit Solutions operates as a Credit Services Organization under Texas law. You have the right to cancel services within 3 business days." },
            { title: "FCRA Rights", desc: "Your right to dispute inaccurate information is protected under the Fair Credit Reporting Act at no cost through AnnualCreditReport.com." },
          ].map((item) => (
            <li key={item.title}>
              <strong className="text-foreground">{item.title}:</strong> {item.desc}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox id="disclosure" checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
          <label htmlFor="disclosure" className="text-sm cursor-pointer">
            I have read and understand the above notices and wish to proceed.
          </label>
        </div>

        <Button onClick={onAccept} disabled={!checked} className="w-full mt-4">
          Proceed to Upload →
        </Button>
      </CardContent>
    </Card>
  );
}

function BureauDropZone({
  bureau,
  state,
  onFileSelect,
}: {
  bureau: (typeof BUREAUS)[0];
  state: BureauState;
  onFileSelect: (bureauKey: string, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(bureau.key, file);
    },
    [bureau.key, onFileSelect]
  );

  const borderClass =
    state.status === "success"
      ? "border-green-500 border-solid bg-green-500/5"
      : state.status === "error"
      ? "border-destructive border-solid"
      : state.status === "uploading"
      ? "border-primary border-solid"
      : dragging
      ? "border-primary bg-primary/5"
      : "border-border border-dashed hover:border-muted-foreground";

  return (
    <div
      className={`relative rounded-xl border-2 p-6 flex flex-col items-center gap-3 cursor-pointer transition-all min-h-[200px] justify-center ${borderClass}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => state.status !== "uploading" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(bureau.key, file);
        }}
      />

      <div className={`w-10 h-10 rounded-lg ${bureau.color} flex items-center justify-center text-white font-bold text-sm`}>
        {bureau.abbr}
      </div>
      <p className="font-medium text-sm">{bureau.label}</p>

      {state.status === "success" ? (
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">{state.file?.name}</p>
            <p className="text-xs">Uploaded successfully!</p>
          </div>
        </div>
      ) : state.status === "error" ? (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <p className="text-xs">{state.error || "Upload failed"}</p>
        </div>
      ) : state.status === "uploading" ? (
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <p className="text-sm font-medium">{state.file?.name}</p>
            <p className="text-xs text-muted-foreground">Uploading & queuing for analysis...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">Drop PDF here or click to browse</p>
          <p className="text-xs text-muted-foreground/60">PDF or CSV · Max 20MB</p>
        </div>
      )}

      {state.status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted rounded-b-xl overflow-hidden">
          <div className="h-full w-3/5 bg-primary rounded-full" style={{ animation: "progress-indeterminate 2s ease-in-out infinite" }} />
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const { user } = useAuth();
  const [disclosed, setDisclosed] = useState(false);
  const [states, setStates] = useState<Record<string, BureauState>>(
    Object.fromEntries(BUREAUS.map((b) => [b.key, { file: null, status: "idle", error: null }]))
  );

  const handleFileSelect = useCallback(
    async (bureauKey: string, file: File) => {
      if (!file.name.match(/\.(pdf|csv)$/i)) {
        setStates((prev) => ({ ...prev, [bureauKey]: { file, status: "error", error: "Only PDF or CSV files are accepted." } }));
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setStates((prev) => ({ ...prev, [bureauKey]: { file, status: "error", error: "File exceeds 20MB limit." } }));
        return;
      }

      setStates((prev) => ({ ...prev, [bureauKey]: { file, status: "uploading", error: null } }));

      try {
        await apiRequest("POST", "/api/reports", {
          userId: user?.id,
          bureau: bureauKey,
          fileName: file.name,
          fileSize: file.size,
        });
        setStates((prev) => ({ ...prev, [bureauKey]: { file, status: "success", error: null } }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setStates((prev) => ({ ...prev, [bureauKey]: { file, status: "error", error: msg } }));
      }
    },
    [user]
  );

  const successCount = Object.values(states).filter((s) => s.status === "success").length;

  if (!disclosed) {
    return (
      <AppLayout>
        <div className="mb-6">
          <h1 className="text-3xl font-serif mb-2">Upload Credit Reports</h1>
          <p className="text-muted-foreground">Please review the following disclosure before uploading.</p>
        </div>
        <UploadDisclosure onAccept={() => setDisclosed(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif mb-2">Upload Credit Reports</h1>
        <p className="text-muted-foreground">Upload reports from one or all three bureaus. You can add missing bureaus at any time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {BUREAUS.map((b) => (
          <BureauDropZone key={b.key} bureau={b} state={states[b.key]} onFileSelect={handleFileSelect} />
        ))}
      </div>

      {successCount > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{successCount} of 3 reports uploaded</span>
              <div className="flex gap-2">
                {BUREAUS.map((b) => (
                  <div
                    key={b.key}
                    className={`w-3 h-3 rounded-full ${states[b.key].status === "success" ? "bg-green-500" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>
            <Link href="/analysis">
              <Button size="sm">
                View Analysis ({successCount} report{successCount > 1 ? "s" : ""}) →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {successCount > 0 && successCount < 3 && (
        <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
          💡 Uploading all 3 bureaus allows cross-bureau comparison and may reveal additional discrepancies.
        </div>
      )}

      {/* Help section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <HelpCircle className="h-4 w-4" />
            How to get your credit reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Free Annual Reports", desc: "AnnualCreditReport.com — mandated by FCRA, free once per year from each bureau" },
              { title: "TransUnion", desc: "TransUnion.com → Sign in → View Report → Download PDF" },
              { title: "Equifax", desc: "Equifax.com → My Equifax → Get Free Credit Report → Download" },
              { title: "Experian", desc: "Experian.com → Free Credit Report → View & Download" },
            ].map((item) => (
              <div key={item.title} className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
