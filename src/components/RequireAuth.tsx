import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "../lib/auth";

/** Local device gate: renders children only when a session exists on this device. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  if (getSession() === null) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
