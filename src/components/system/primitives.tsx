import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Tone = "void" | "charcoal" | "ivory";

const toneClass: Record<Tone, string> = {
  void: "bg-[#070c12] text-white",
  charcoal: "bg-[#10161d] text-white",
  ivory: "bg-[#f3efe6] text-[#0c1218]",
};

interface SectionProps extends HTMLAttributes<HTMLElement> {
  tone?: Tone;
  contained?: boolean;
}

export const Section = ({
  tone = "void",
  contained = true,
  className = "",
  children,
  ...props
}: SectionProps) => (
  <section className={`relative overflow-hidden py-20 md:py-28 ${toneClass[tone]} ${className}`} {...props}>
    {contained ? <div className="relative max-w-6xl mx-auto px-4">{children}</div> : children}
  </section>
);

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  align?: "center" | "left";
  inverted?: boolean;
}

export const SectionHeading = ({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = "center",
  inverted = false,
}: SectionHeadingProps) => (
  <div className={`${align === "center" ? "text-center mx-auto" : "text-left"} max-w-3xl space-y-4`}>
    <p
      className={`inline-flex items-center gap-3 text-[11px] tracking-[0.38em] uppercase font-semibold ${
        inverted ? "text-lime-200/75" : "text-emerald-800/70"
      }`}
    >
      <span className={`h-px w-8 ${inverted ? "bg-lime-300/40" : "bg-emerald-700/30"}`} />
      {eyebrow}
      <span className={`h-px w-8 ${inverted ? "bg-lime-300/40" : "bg-emerald-700/30"}`} />
    </p>
    <h2
      className={`font-display font-bold tracking-tight text-3xl md:text-5xl leading-[1.05] ${
        inverted ? "text-white" : "text-[#0c1218]"
      }`}
    >
      {title}
      {highlight ? (
        <>
          {" "}
          <span className="bg-gradient-to-r from-lime-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
            {highlight}
          </span>
        </>
      ) : null}
    </h2>
    {subtitle ? (
      <p className={`text-base md:text-lg leading-relaxed ${inverted ? "text-white/65" : "text-[#0c1218]/65"}`}>
        {subtitle}
      </p>
    ) : null}
  </div>
);

export const PremiumCard = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rh-card rounded-[22px] p-6 transition-transform duration-300 hover:-translate-y-1 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const GlowButton = ({
  className = "",
  children,
  variant = "solid",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" }) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold uppercase tracking-[0.14em] transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 ${
      variant === "solid"
        ? "bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 text-[#06231a] shadow-[0_0_36px_rgba(163,230,53,0.28)] hover:shadow-[0_0_56px_rgba(163,230,53,0.42)] hover:-translate-y-0.5"
        : "border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/30"
    } ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const StatusBadge = ({
  children,
  pulse = true,
}: {
  children: ReactNode;
  pulse?: boolean;
}) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-200/85">
    {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-lime-300 animate-pulse" /> : null}
    {children}
  </span>
);

export const DataPanel = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rh-card rounded-[20px] p-5">
    <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">{label}</p>
    <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
    {hint ? <p className="mt-2 text-sm text-white/45">{hint}</p> : null}
  </div>
);

export const DashboardCard = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="rh-card rounded-[22px] p-6 md:p-7">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
        {description ? <p className="mt-1.5 text-sm text-white/50 leading-relaxed">{description}</p> : null}
      </div>
      {action}
    </div>
    {children ? <div className="mt-5">{children}</div> : null}
  </div>
);

export const AnimatedBackground = ({ variant = "void" }: { variant?: "void" | "auth" }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div
      className="absolute -top-40 left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full blur-3xl opacity-80"
      style={{ background: "radial-gradient(closest-side, rgba(38,120,84,0.28), transparent 70%)" }}
    />
    <div
      className="blob-float-slow absolute top-1/3 -left-40 h-[480px] w-[480px] rounded-full blur-3xl"
      style={{ background: "radial-gradient(closest-side, rgba(22,80,64,0.24), transparent 70%)" }}
    />
    <div
      className="blob-float absolute top-1/4 -right-40 h-[520px] w-[520px] rounded-full blur-3xl"
      style={{ background: "radial-gradient(closest-side, rgba(140,220,90,0.1), transparent 70%)" }}
    />
    {variant === "auth" ? (
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(190,255,220,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(190,255,220,0.6) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
        }}
      />
    ) : null}
  </div>
);

export const PageShell = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={`relative min-h-[100dvh] bg-[#050a10] text-white ${className}`}>
    <AnimatedBackground variant="auth" />
    <div className="relative">{children}</div>
  </div>
);
