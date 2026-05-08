import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Appointments from "./pages/Appointments";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Notes from "./pages/Notes";
import PatientProfile from "./pages/PatientProfile";
import Patients from "./pages/Patients";
import Session from "./pages/Session";
import Settings from "./pages/Settings";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

function RouteTitle() {
  const location = useLocation();
  const titleMap: Record<string, string> = {
    "/": "Dashboard",
    "/appointments": "Appointments",
    "/patients": "Patients",
    "/notes": "Notes",
    "/settings": "Settings",
    "/login": "Login",
  };

  const pageTitle = location.pathname.startsWith("/session/")
    ? "Active Session"
    : location.pathname.startsWith("/patients/")
      ? "Patient Profile"
      : titleMap[location.pathname] || "MedFlow";

  useEffect(() => {
    document.title = `${pageTitle} | MedFlow`;
  }, [pageTitle]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <RouteTitle />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/session/:appointmentId" element={<ProtectedRoute><Session /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
