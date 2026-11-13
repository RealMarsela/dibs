import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";
import { TripProvider } from "@/data/store";
import { LandingPage } from "@/pages/landing";
import { TripPage } from "@/pages/trip";
import { NewTripPage } from "@/pages/new-trip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TripProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/t/:code" element={<TripPage />} />
          <Route path="/new" element={<NewTripPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </BrowserRouter>
  </StrictMode>,
);
