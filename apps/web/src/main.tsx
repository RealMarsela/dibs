import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { TripProvider } from "@/data/store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LandingPage } from "@/pages/landing";
import { TripPage } from "@/pages/trip";
import { NewTripPage } from "@/pages/new-trip";

/* Each route fades in on its own key (Hoy's main: opacity .3s), and a new page starts at the top. */
function AppRoutes() {
  const loc = useLocation();
  useEffect(() => {
    if (!loc.hash) window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  return (
    <div key={loc.pathname} className="page-in">
      <Routes location={loc}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/t/:code" element={<TripPage />} />
        <Route path="/new" element={<NewTripPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <TripProvider>
          <AppRoutes />
          <Toaster theme="dark" position="bottom-center" toastOptions={{ className: "!rounded-2xl !border-line !bg-panel !text-fg" }} />
        </TripProvider>
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
);
