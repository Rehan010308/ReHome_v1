import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, X } from "lucide-react";

/**
 * Live QR scanning for the receiving organization.
 *
 * Decoding runs entirely on-device against frames pulled from the video
 * element — no image ever leaves the browser. When a camera is not available
 * the component says so and the caller keeps a typed-reference path, because
 * an organization standing in front of a donor must never be blocked by a
 * permission prompt.
 */

type Phase = "requesting" | "live" | "denied" | "unsupported" | "error";

const MESSAGE: Record<Exclude<Phase, "requesting" | "live">, string> = {
  denied: "Camera permission was declined. Enter the reference code instead.",
  unsupported: "No camera is available here. Enter the reference code instead.",
  error: "The camera could not be started. Enter the reference code instead.",
};

export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("requesting");

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || doneRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      // Decode at a reduced size: jsQR is fast, but a 1080p frame every tick is
      // wasted work on a phone held over a counter.
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(frame.data, frame.width, frame.height, {
          inversionAttempts: "dontInvert",
        });
        if (found?.data) {
          doneRef.current = true;
          stop();
          onResult(found.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onResult, stop]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setPhase("live");
        rafRef.current = requestAnimationFrame(tick);
      } catch (cause) {
        if (cancelled) return;
        const name = (cause as { name?: string })?.name ?? "";
        setPhase(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : name === "NotFoundError"
              ? "unsupported"
              : "error"
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop, tick]);

  const failed = phase === "denied" || phase === "unsupported" || phase === "error";

  return (
    <div className="rh-surface overflow-hidden rounded-[22px]">
      <div className="relative aspect-[4/3] w-full bg-black">
        {!failed ? (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-[62%] aspect-square">
                {(["tl", "tr", "bl", "br"] as const).map((c) => (
                  <span key={c} className={`rh-bracket rh-bracket-${c}`} style={{ opacity: 0.95, margin: 0 }} />
                ))}
              </div>
            </div>
            {phase === "requesting" ? (
              <p className="rh-mono absolute inset-0 grid place-items-center text-[10px] tracking-[0.3em] text-white/45">
                WAITING FOR CAMERA
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid h-full w-full place-items-center px-8 text-center">
            <div>
              <CameraOff className="mx-auto h-7 w-7 text-white/30" />
              <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/55">
                {MESSAGE[phase]}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-3.5">
        <button
          type="button"
          onClick={() => { stop(); onClose(); }}
          className="inline-flex items-center gap-2 text-[13px] text-white/45 transition-colors hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        <span className="rh-mono text-[10px] tracking-[0.22em] text-white/25">
          {phase === "live" ? "POINT AT THE DONOR'S CODE" : failed ? "CAMERA UNAVAILABLE" : "STARTING"}
        </span>
      </div>
    </div>
  );
}
