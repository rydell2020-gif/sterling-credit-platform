import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import UploadPage from "@/pages/UploadPage";
import AnalysisPage from "@/pages/AnalysisPage";
import DisputesPage from "@/pages/DisputesPage";
import ReportPage from "@/pages/ReportPage";
import ComparisonPage from "@/pages/ComparisonPage";
import ExpensesPage from "@/pages/ExpensesPage";
import CalendarPage from "@/pages/CalendarPage";
import CompliancePage from "@/pages/CompliancePage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  if (!user) {
    return <Redirect to="/" />;
  }
  return <Component />;
}

function AppRouter() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <LoginPage />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/upload">
        <ProtectedRoute component={UploadPage} />
      </Route>
      <Route path="/analysis">
        <ProtectedRoute component={AnalysisPage} />
      </Route>
      <Route path="/disputes">
        <ProtectedRoute component={DisputesPage} />
      </Route>
      <Route path="/report">
        <ProtectedRoute component={ReportPage} />
      </Route>
      <Route path="/comparison">
        <ProtectedRoute component={ComparisonPage} />
      </Route>
      <Route path="/expenses">
        <ProtectedRoute component={ExpensesPage} />
      </Route>
      <Route path="/calendar">
        <ProtectedRoute component={CalendarPage} />
      </Route>
      <Route path="/compliance">
        <CompliancePage />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
