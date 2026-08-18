import type { ReactNode } from "react";
import "./PageContainer.css";

type PageContainerProps = {
  children: ReactNode;
};

export function PageContainer({ children }: PageContainerProps) {
  return <main className="page-container">{children}</main>;
}