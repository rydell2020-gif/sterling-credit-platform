import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Shield, CheckCircle, AlertTriangle, Mail } from "lucide-react";
import scsLogo from "@assets/scs-logo.jpg";

type AuthMode = "login" | "signup" | "magic";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [croa, setCroa] = useState(false);
  const [cso, setCso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (mode === "signup" && (!croa || !cso)) {
      setError("You must acknowledge both disclosures to create an account.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await apiRequest("POST", "/api/auth/login", { email, password });
        const data = await res.json();
        setUser(data.user);
        navigate("/dashboard");
      } else if (mode === "signup") {
        const res = await apiRequest("POST", "/api/auth/signup", { email, password, fullName: name });
        const data = await res.json();
        setUser(data.user);
        navigate("/dashboard");
      } else {
        setMagicSent(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("GET", "/api/auth/demo");
      const data = await res.json();
      setUser(data.user);
      navigate("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Demo login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-background to-card border-r border-border p-12">
        <div className="flex flex-col gap-10 max-w-md">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img
                src={scsLogo}
                alt="Sterling Credit Solutions logo"
                className="w-14 h-14 rounded-full object-cover"
                data-testid="img-logo-desktop"
              />
            </div>
            <h1 className="font-serif text-2xl text-foreground mt-3">Sterling Credit Solutions</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Your path to homeownership starts with understanding your credit.
            </p>
          </div>

          <div className="space-y-4">
            {[
              "Analyze all 3 bureaus",
              "Generate FCRA dispute letters",
              "AI-powered recommendations",
              "Download professional reports",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="p-4 bg-primary/5 border-l-2 border-primary rounded-r-lg">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-primary">Compliance-First Platform</strong>
              <br />
              FCRA · CROA · Texas CSO Compliant
              <br />
              Educational tools only · No guaranteed results
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src={scsLogo}
              alt="Sterling Credit Solutions logo"
              className="w-10 h-10 rounded-full object-cover"
              data-testid="img-logo-mobile"
            />
            <h1 className="font-serif text-xl">Sterling Credit Solutions</h1>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">
                {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Magic Link"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {magicSent ? (
                <div className="text-center py-8 space-y-3">
                  <Mail className="h-10 w-10 text-primary mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    Check your email! We sent a magic link to <strong className="text-foreground">{email}</strong>
                  </p>
                </div>
              ) : (
                <>
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                    />
                  </div>

                  {mode !== "magic" && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {mode === "signup" && (
                    <div className="p-4 bg-primary/5 border border-primary/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="croa"
                          checked={croa}
                          onCheckedChange={(v) => setCroa(!!v)}
                          className="mt-0.5"
                        />
                        <label htmlFor="croa" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                          I have received and reviewed the <strong className="text-primary">CROA Disclosure</strong>.
                          I understand SCS provides educational services only, makes no guarantee of results,
                          and I have the right to dispute information with credit bureaus for free.
                        </label>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="cso"
                          checked={cso}
                          onCheckedChange={(v) => setCso(!!v)}
                          className="mt-0.5"
                        />
                        <label htmlFor="cso" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                          I acknowledge the <strong className="text-primary">Texas CSO Notice</strong>: I have the right
                          to cancel services within 3 business days. No payment is required before services are performed.
                        </label>
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                    {loading
                      ? "Please wait..."
                      : mode === "login"
                      ? "Sign In"
                      : mode === "signup"
                      ? "Create Account"
                      : "Send Magic Link"}
                  </Button>

                  <Button variant="outline" className="w-full" onClick={handleDemoLogin} disabled={loading}>
                    <Shield className="h-4 w-4 mr-2" />
                    Demo Login
                  </Button>

                  <div className="flex items-center justify-center gap-3 text-sm">
                    {mode === "login" ? (
                      <>
                        <button onClick={() => setMode("signup")} className="text-blue-400 hover:underline">
                          Create account
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => setMode("magic")} className="text-blue-400 hover:underline">
                          Magic link
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setMode("login")} className="text-blue-400 hover:underline">
                        ← Back to sign in
                      </button>
                    )}
                  </div>
                </>
              )}

              <p className="text-xs text-center text-muted-foreground leading-relaxed pt-2">
                This platform provides educational information only. No legal or financial advice.
                No guaranteed results.
              </p>
            </CardContent>
          </Card>
          <PerplexityAttribution />
        </div>
      </div>
    </div>
  );
}
