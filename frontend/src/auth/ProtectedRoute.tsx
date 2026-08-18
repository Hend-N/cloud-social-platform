import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isLoggedIn } from "./token";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}