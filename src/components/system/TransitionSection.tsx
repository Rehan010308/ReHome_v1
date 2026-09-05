export const TransitionSection = () => (
  <div className="relative h-24 md:h-32 bg-[#050a10]" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, rgba(5,10,16,1) 0%, rgba(7,12,18,0.96) 42%, rgba(7,12,18,1) 100%)",
      }}
    />
    <div
      className="absolute inset-x-0 bottom-0 h-px"
      style={{
        background: "linear-gradient(90deg, transparent, rgba(163,230,53,0.28), transparent)",
      }}
    />
  </div>
);
