import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { PageContainer } from "./PageContainer";

// One navigation system for desktop and mobile; no duplicate sidebar/foot nav.
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="shell">
        <PageContainer>{children}</PageContainer>
      </div>
    </>
  );
}
