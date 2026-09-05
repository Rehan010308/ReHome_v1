import { useEffect, useRef, type ReactNode } from "react";

/**
 * One orchestrated entrance per view.
 *
 * Sections arrive once, in sequence, as the reader reaches them — and never
 * again. Re-animating on every scroll direction is the tell that turns motion
 * into decoration.
 */
export const Reveal = ({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering siblings within one moment. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "header" | "li";
}) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`rh-enter ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};
