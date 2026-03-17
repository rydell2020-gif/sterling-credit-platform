import { AppSidebar } from "./AppSidebar";
import { PerplexityAttribution } from "./PerplexityAttribution";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
        <div className="border-t border-border px-8 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sterling Credit Solutions · Educational Use Only · Not Legal or Financial Advice</span>
            <span>FCRA · CROA · Texas CSO Compliant</span>
          </div>
        </div>
        <PerplexityAttribution />
      </div>
    </div>
  );
}
