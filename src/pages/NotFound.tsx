import { Link } from "react-router-dom";
import { GlowButton } from "@/components/system/primitives";

const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 pt-28 text-white bg-[#050a10]">
    <p className="text-[11px] tracking-[0.4em] uppercase text-lime-200/70">Lost in transit</p>
    <p className="mt-4 text-6xl font-display font-bold bg-gradient-to-r from-lime-300 to-teal-300 bg-clip-text text-transparent">
      404
    </p>
    <h1 className="text-2xl font-display font-semibold mt-4">This route does not exist</h1>
    <p className="text-white/50 mt-2 max-w-md">
      The page may arrive in a later phase, or the URL may be incomplete.
    </p>
    <Link to="/" className="mt-8">
      <GlowButton>Return home</GlowButton>
    </Link>
  </div>
);

export default NotFound;
