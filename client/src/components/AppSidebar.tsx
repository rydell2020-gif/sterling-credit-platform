import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  FileText,
  GitCompare,
  Download,
  Shield,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/analysis", label: "Analysis", icon: BarChart3 },
  { path: "/disputes", label: "Disputes", icon: FileText },
  { path: "/comparison", label: "Comparison", icon: GitCompare },
  { path: "/report", label: "Report", icon: Download },
  { path: "/compliance", label: "Compliance", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.hash = "#/";
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-serif font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="font-serif text-lg leading-tight text-sidebar-foreground">Sterling</h1>
            <p className="text-xs text-muted-foreground">Credit Solutions</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location === "/admin"
                ? "bg-sidebar-accent text-primary"
                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <Settings className={`h-4 w-4 ${location === "/admin" ? "text-primary" : ""}`} />
            Admin
          </Link>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-sm font-semibold">
              {user?.fullName?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.fullName || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
