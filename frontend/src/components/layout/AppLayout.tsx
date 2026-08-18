import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { PageContainer } from "./PageContainer";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <Navbar />
      <PageContainer>{children}</PageContainer>
    </>
  );
}