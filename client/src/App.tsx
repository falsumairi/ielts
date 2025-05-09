import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "./lib/protected-route";
import { GamificationProvider } from "./hooks/use-gamification";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import ReadingTest from "@/pages/reading-test";
import ListeningTest from "@/pages/listening-test";
import SpeakingTest from "@/pages/speaking-test";
import WritingTest from "@/pages/writing-test";
import Results from "@/pages/results";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminResults from "@/pages/admin/results";
import AdminTests from "@/pages/admin/tests";
import ForgotPassword from "@/pages/forgot-password";
import VerifyEmail from "@/pages/verify-email";
import VocabularyPage from "@/pages/vocabulary-page";
import VocabularyReview from "@/pages/vocabulary-review";
import Achievements from "@/pages/achievements";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      
      {/* User Routes */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/tests/reading/:id" component={ReadingTest} />
      <ProtectedRoute path="/tests/listening/:id" component={ListeningTest} />
      <ProtectedRoute path="/tests/speaking/:id" component={SpeakingTest} />
      <ProtectedRoute path="/tests/writing/:id" component={WritingTest} />
      <ProtectedRoute path="/results" component={Results} />
      <ProtectedRoute path="/vocabulary" component={VocabularyPage} />
      <ProtectedRoute path="/vocabulary/review" component={VocabularyReview} />
      <ProtectedRoute path="/achievements" component={Achievements} />
      
      {/* Admin Routes */}
      <ProtectedRoute path="/admin" component={AdminDashboard} adminOnly={true} />
      <ProtectedRoute path="/admin/dashboard" component={AdminDashboard} adminOnly={true} />
      <ProtectedRoute path="/admin/results" component={AdminResults} adminOnly={true} />
      <ProtectedRoute path="/admin/tests" component={AdminTests} adminOnly={true} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <GamificationProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </GamificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
