import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Shield, CheckCircle, AlertTriangle, Crown } from "lucide-react";
import scsLogo from "@assets/scs-logo.jpg";

type PublicInvite = {
  token: string;
  email: string;
  fullName: string | null;
  role: "user" | "admin" | "owner";
  message?: string | null;
  expiresAt: string | null;
  status?: string;
};

export default function InvitePage() {
  const [, params] = useRoute("/invite/:token");
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const token = params?.token || "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [croa, setCroa] = useState(false);
  const [cso, setCso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: invite, isLoading, error: fetchError } = useQuery<PublicInvite>({
    queryKey: ["/api/invites", token],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invites/${token}`);
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Prefill full name from invite once loaded
  if (invite?.fullName && !fullName) {
    setFullName(invite.fullName);
  }

  const handleAccept = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    if (!croa || !cso) {
      setError("You must acknowledge both disclosures to activate your account.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/invites/${token}/accept`, { fullName, password });
      const data = await res.json();
      setUser(data.user);
      navigate(data.user.role === "admin" || data.user.role === "owner" ? "/admin" : "/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not accept invite");
    }
    setLoading(false);
  };

  const roleLabel = invite?.role === "owner" ? "Owner" : invite?.role === "admin" ? "Admin" : "Client";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-background to-card border-r border-border p-12">
        <div className="flex flex-col gap-10 max-w-md">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src={scsLogo} alt="Sterling Credit Solutions logo" className="h-10 w-10 rounded-lg object-cover" />
              <div>
                <h1 className="font-serif text-2xl leading-tight">Sterling Credit Solutions</h1>
                <p className="text-xs text-muted-foreground">Credit repair & mortgage readiness</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="font-serif text-3xl leading-tight">
              You've been invited to join Sterling.
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Activate your account to access your personalized credit dashboard, secure document
              uploads, dispute tracking, and 1:1 coaching from Rydell and the Sterling team.
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Bank-grade encryption for all uploads</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Real-time dispute status across TransUnion, Equifax & Experian</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Mortgage-readiness planning tailored to your goals</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Enrollment</span>
            </div>
            <CardTitle className="font-serif text-2xl">Activate your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading && (
              <div className="text-sm text-muted-foreground">Loading invitation…</div>
            )}

            {fetchError && (
              <Alert variant="destructive" data-testid="alert-invite-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This invitation link is invalid, revoked, or expired. Please contact Sterling
                  Credit Solutions for a new one, or{" "}
                  <button onClick={() => navigate("/login")} className="text-primary underline">
                    sign up on your own
                  </button>.
                </AlertDescription>
              </Alert>
            )}

            {invite && invite.status !== "pending" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This invitation has already been {invite.status}.{" "}
                  <button onClick={() => navigate("/login")} className="text-primary underline">
                    Go to sign in
                  </button>.
                </AlertDescription>
              </Alert>
            )}

            {invite && invite.status === "pending" && (
              <>
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Invited email</span>
                    <Badge variant="outline" className={`text-xs ${invite.role === "owner" ? "text-primary border-primary/60 bg-primary/10" : invite.role === "admin" ? "text-primary border-primary/30" : ""}`}>
                      {invite.role === "owner" && <Crown className="h-3 w-3 inline mr-1 -mt-0.5" />}
                      {roleLabel}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium" data-testid="text-invite-email">{invite.email}</p>
                  {invite.message && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2 mt-2">
                      "{invite.message}"
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                  <Input
                    id="fullName"
                    data-testid="input-invite-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your legal name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Create Password</Label>
                  <Input
                    id="password"
                    data-testid="input-invite-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPw" className="text-xs">Confirm Password</Label>
                  <Input
                    id="confirmPw"
                    data-testid="input-invite-confirm"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-start gap-2">
                    <Checkbox id="croa" checked={croa} onCheckedChange={(v) => setCroa(!!v)} data-testid="checkbox-croa" />
                    <label htmlFor="croa" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                      I acknowledge my rights under the <strong>Credit Repair Organizations Act (CROA)</strong>, including the right to cancel this contract within 3 business days without penalty.
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="cso" checked={cso} onCheckedChange={(v) => setCso(!!v)} data-testid="checkbox-cso" />
                    <label htmlFor="cso" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                      I acknowledge my rights under the <strong>Texas Credit Services Organization Act (CSO)</strong> and consent to Sterling Credit Solutions acting on my behalf.
                    </label>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleAccept}
                  disabled={loading || !password || !confirmPw || !fullName || !croa || !cso}
                  className="w-full"
                  data-testid="button-accept-invite"
                >
                  {loading ? "Activating…" : "Activate Account"}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => navigate("/login")} className="text-primary hover:underline" data-testid="link-signin">
                    Sign in
                  </button>
                </p>
              </>
            )}

            <PerplexityAttribution />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
