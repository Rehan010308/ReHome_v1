import type { HTMLAttributes } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {}

export const Container = ({ className = "", ...props }: ContainerProps) => (
  <div className={`max-w-6xl mx-auto px-4 ${className}`} {...props} />
);