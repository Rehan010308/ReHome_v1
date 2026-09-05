import { Badge } from "./Badge";

interface SectionHeadingProps {
  badge: string;
  title: string;
  /** Words rendered with the emerald→amber gradient (e.g. "A Second Life"). */
  highlight?: string;
  subtitle?: string;
}

export const SectionHeading = ({ badge, title, highlight, subtitle }: SectionHeadingProps) => (
  <div className="text-center space-y-3">
    <Badge>{badge}</Badge>
    <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight">
      {title}
      {highlight && (
        <>
          {" "}
          <span className="bg-gradient-to-r from-primary via-emerald-400 to-amber-400 bg-clip-text text-transparent">
            {highlight}
          </span>
        </>
      )}
    </h2>
    {subtitle && (
      <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">{subtitle}</p>
    )}
  </div>
);