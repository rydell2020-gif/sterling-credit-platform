import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import {
  Shield, Upload, HelpCircle, FileText, IdCard, Receipt, Files, X, CheckCircle, Loader2,
} from "lucide-react";
import type { Document as DocRecord } from "@shared/schema";

interface DocZone {
  docType: string;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  accept: string;
  multiple: boolean;
  isReport?: boolean;
}

const ZONES: DocZone[] = [
  { docType: "3b_report", title: "3B or 4K Full Consumer Report", subtitle: "PDF · IdentityIQ, SmartCredit, or similar", icon: FileText, accept: ".pdf", multiple: false, isReport: true },
  { docType: "id_license", title: "ID or Driver's License", subtitle: "JPG, PNG or PDF · Front and back", icon: IdCard, accept: ".jpg,.jpeg,.png,.pdf", multiple: false },
  { docType: "utility_bill", title: "Utility Bill", subtitle: "PDF, JPG or PNG · Proof of address", icon: Receipt, accept: ".pdf,.jpg,.jpeg,.png", multiple: false },
  { docType: "other", title: "Other Documents", subtitle: "Any format · Multiple files allowed", icon: Files, accept: "*", multiple: true },
];

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
        <p className="text-sm text-muted-foreground">By uploading your documents, you acknowledge the following:</p>
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

        <Button onClick={onAccept} disabled={!checked} className="w-full mt-4" data-testid="button-accept-disclosure">
          Proceed to Upload →
        </Button>
      </CardContent>
    </Card>
  );
}

function DocDropZone({
  zone,
  docs,
  uploading,
  onFilesSelect,
  onRemove,
}: {
  zone: DocZone;
  docs: DocRecord[];
  uploading: boolean;
  onFilesSelect: (zone: DocZone, files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) onFilesSelect(zone, e.dataTransfer.files);
    },
    [zone, onFilesSelect]
  );

  const Icon = zone.icon;
  const hasFiles = docs.length > 0;

  return (
    <Card data-testid={`zone-${zone.docType}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{zone.title}</p>
            <p className="text-xs text-muted-foreground">{zone.subtitle}</p>
          </div>
        </div>

        <div
          className={`relative rounded-xl border-2 p-6 flex flex-col items-center gap-2 cursor-pointer transition-all min-h-[120px] justify-center ${
            dragging ? "border-primary bg-primary/5" : "border-border border-dashed hover:border-muted-foreground"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          data-testid={`dropzone-${zone.docType}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={zone.accept === "*" ? undefined : zone.accept}
            multiple={zone.multiple}
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) onFilesSelect(zone, e.target.files); }}
          />
          {uploading ? (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Uploading…</span>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground text-center">Drop file{zone.multiple ? "s" : ""} here or click to browse</p>
            </>
          )}
        </div>

        {/* Uploaded file chips */}
        {hasFiles && (
          <div className="mt-3 space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20" data-testid={`file-chip-${d.id}`}>
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-xs font-medium flex-1 truncate">{d.fileName}</span>
                <button
                  onClick={() => onRemove(d.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  data-testid={`button-remove-${d.id}`}
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function UploadPage() {
  const { user } = useAuth();
  const [disclosed, setDisclosed] = useState(false);
  const [uploadingZone, setUploadingZone] = useState<string | null>(null);

  const { data: documents = [] } = useQuery<DocRecord[]>({
    queryKey: ["/api/documents", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: !!user,
  });

  const uploadMut = useMutation({
    mutationFn: async ({ zone, files }: { zone: DocZone; files: FileList }) => {
      const arr = Array.from(files);
      for (const file of arr) {
        await apiRequest("POST", "/api/documents", {
          userId: user?.id,
          docType: zone.docType,
          fileName: file.name,
          fileSize: file.size,
        });
      }
    },
    onMutate: ({ zone }) => setUploadingZone(zone.docType),
    onSettled: () => setUploadingZone(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/documents", user?.id] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/documents/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/documents", user?.id] }),
  });

  const docsFor = (docType: string) => documents.filter((d) => d.docType === docType);
  const hasReport = documents.some((d) => d.docType === "3b_report" || d.docType === "4k_report");

  if (!disclosed) {
    return (
      <AppLayout>
        <div className="mb-6" data-testid="page-upload">
          <h1 className="text-3xl font-serif mb-2">Upload Documents</h1>
          <p className="text-muted-foreground">Please review the following disclosure before uploading.</p>
        </div>
        <UploadDisclosure onAccept={() => setDisclosed(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div data-testid="page-upload">
        <div className="mb-8">
          <h1 className="text-3xl font-serif mb-2">Upload Documents</h1>
          <p className="text-muted-foreground">Upload your consumer report and supporting documents to begin your analysis.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {ZONES.map((zone) => (
            <DocDropZone
              key={zone.docType}
              zone={zone}
              docs={docsFor(zone.docType)}
              uploading={uploadingZone === zone.docType}
              onFilesSelect={(z, files) => uploadMut.mutate({ zone: z, files })}
              onRemove={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>

        {/* Continue */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {hasReport ? "Report uploaded — ready for analysis" : "Upload a consumer report to continue"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {documents.length} document{documents.length === 1 ? "" : "s"} uploaded
              </p>
            </div>
            <Link href="/analysis">
              <Button size="sm" disabled={!hasReport} data-testid="button-continue-analysis">
                Continue to Analysis →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Help section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <HelpCircle className="h-4 w-4" />
              How to get your documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "3B / 4K Consumer Report", desc: "IdentityIQ.com or SmartCredit.com provide combined 3-bureau reports in a single PDF" },
                { title: "Free Annual Reports", desc: "AnnualCreditReport.com — mandated by FCRA, free once per year from each bureau" },
                { title: "ID / Driver's License", desc: "A clear photo or scan of your government-issued ID confirms your identity for disputes" },
                { title: "Utility Bill", desc: "A recent utility bill (electric, water, gas) serves as proof of your current address" },
              ].map((item) => (
                <div key={item.title} className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm font-medium mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
