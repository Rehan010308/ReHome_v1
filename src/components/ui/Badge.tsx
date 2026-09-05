import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: boolean;
}

export const Badge = ({ dot = true, className = "", children, ...props }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass text-primary text-sm font-semibold ${className}`}
    {...props}
  >
    {dot && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
    {children}
  </span>
);