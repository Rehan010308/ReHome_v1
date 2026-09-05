import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = ({ className = "", ...props }: CardProps) => (
  <div className={`glass-card gradient-border-animated rounded-2xl ${className}`} {...props} />
);