import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "gradient" | "light";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
  outline:
    "border-2 border-border/70 hover:border-primary/40 hover:bg-primary/5 backdrop-blur-sm",
  ghost: "hover:bg-muted",
  gradient:
    "bg-gradient-to-r from-primary to-emerald-500 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5",
  light: "bg-white text-primary hover:bg-white/90 shadow-lg",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-6 text-base md:text-lg",
  icon: "p-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
);

Button.displayName = "Button";