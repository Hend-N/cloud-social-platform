import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { PageContainer } from "./PageContainer";
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="shell">
        <Sidebar />
        <PageContainer>{children}</PageContainer>
      </div>
      <MobileNav />
    </>
  );
}
