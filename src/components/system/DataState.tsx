export const LoadingState = ({ label = "Loading" }: { label?: string }) => (
  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
    <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">{label}</p>
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-[20px] border border-rose-300/20 bg-rose-300/10 px-4 py-4 text-sm text-rose-100">
    {message}
  </div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
    {message}
  </div>
);
