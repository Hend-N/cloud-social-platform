import type { CSSProperties, ReactNode } from "react";
import "./Card.css";

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  interactive?: boolean;
};

export function Card({ children, style, className, interactive = false }: CardProps) {
  const classes = ["card", interactive ? "card-interactive" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
