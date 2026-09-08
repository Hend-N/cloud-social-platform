import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "./token";
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return isLoggedIn() ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  );
}
