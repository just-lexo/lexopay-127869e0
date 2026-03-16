import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DevToolsButton } from "@/components/DevToolsButton";
import { HideLovableBadge } from "@/components/HideLovableBadge";
 import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Convert from "./pages/Convert";
import Withdraw from "./pages/Withdraw";
import Send from "./pages/Send";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Receipt from "./pages/Receipt";
import Admin from "./pages/Admin";
import AdminFeedback from "./pages/AdminFeedback";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Request from "./pages/Request";
import PublicProfile from "./pages/PublicProfile";
import Notifications from "./pages/Notifications";

const queryClient = new QueryClient();

const CatchAllRoute = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/@')) {
    return <PublicProfile />;
  }
  return <NotFound />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/deposit" 
              element={
                <ProtectedRoute>
                  <Deposit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/convert" 
              element={
                <ProtectedRoute>
                  <Convert />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/withdraw" 
              element={
                <ProtectedRoute>
                  <Withdraw />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/send" 
              element={
                <ProtectedRoute>
                  <Send />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transactions" 
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transactions/:id" 
              element={
                <ProtectedRoute>
                  <TransactionDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/receipt/:id" 
              element={
                <ProtectedRoute>
                  <Receipt />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/feedback" 
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFeedback />
                </ProtectedRoute>
              } 
            />
             <Route 
               path="/profile" 
               element={
                 <ProtectedRoute>
                   <Profile />
                 </ProtectedRoute>
               } 
             />
            <Route 
              path="/request" 
              element={
                <ProtectedRoute>
                  <Request />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<CatchAllRoute />} />
          </Routes>
          <DevToolsButton />
          <HideLovableBadge />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
