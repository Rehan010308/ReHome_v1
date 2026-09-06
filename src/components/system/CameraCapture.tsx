import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, X } from "lucide-react";

/**
 * Live camera capture.
 *
 * A file input with `capture` opens the camera on a phone but does nothing on a
 * laptop, which is why scanning felt like it was missing: on desktop the whole
 * "point your camera at it" idea never appeared. This uses getUserMedia so the
 * viewfinder is genuinely in the page on any device that has a camera, and it
 * degrades honestly everywhere else — the caller always keeps an upload path,
 * and this component says plainly when the camera is unavailable rather than
 * pretending to be one.
 *
 * The stream is stopped on unmount and on close. Nothing is uploaded from here;
 * a still is handed back as a File and the existing flow takes it from there.
 */

type Phase = "requesting" | "live" | "denied" | "unsupported" | "error";

const MESSAGE: Record<Exclude<Phase, "requesting" | "live">, string> = {
  denied:
    "Camera permission was declined. You can allow it in your browser's site settings, or upload a photo instead.",
  unsupported:
    "This browser or connection cannot open a camera. Uploading a photo works exactly the same way.",
  error: "The camera could not be started. Uploading a photo works exactly the same way.",
};

export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("requesting");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        return;
      }
      setPhase("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
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
      } catch (cause) {
        if (cancelled) return;
        const name = (cause as { name?: string })?.name ?? "";
        setPhase(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : name === "NotFoundError" || name === "OverconstrainedError"
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
  }, [facing, stop]);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    setFlash(true);
    window.setTimeout(() => setFlash(false), 220);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(new File([blob], `rehome-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, stop]);

  const close = () => {
    stop();
    onClose();
  };

  const failed = phase === "denied" || phase === "unsupported" || phase === "error";

  return (
    <div className="rh-surface overflow-hidden rounded-[26px]">
      <div className="relative aspect-[4/3] w-full bg-black">
        {!failed ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover transition-opacity duration-500 ${
                phase === "live" ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* Framing guides, so the viewfinder reads as an instrument. */}
            <div className="pointer-events-none absolute inset-0">
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <span key={c} className={`rh-bracket rh-bracket-${c}`} style={{ opacity: 0.9, margin: 14 }} />
              ))}
            </div>
            {phase === "requesting" ? (
              <div className="absolute inset-0 grid place-items-center">
                <p className="rh-mono text-[10px] tracking-[0.3em] text-white/45">
                  WAITING FOR CAMERA PERMISSION
                </p>
              </div>
            ) : null}
            <span
              className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-200"
              style={{ opacity: flash ? 0.85 : 0 }}
              aria-hidden
            />
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

      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-4">
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-2 text-[13px] text-white/45 transition-colors hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>

        {phase === "live" ? (
          <button
            type="button"
            onClick={shoot}
            aria-label="Capture photo"
            className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-lime-300 to-emerald-400 text-[#06231a] transition-transform duration-300 hover:scale-105"
            style={{ boxShadow: "0 0 40px rgba(163,230,53,0.4)" }}
          >
            <Camera className="h-5 w-5" />
          </button>
        ) : (
          <span className="rh-mono text-[10px] tracking-[0.24em] text-white/25">
            {failed ? "CAMERA UNAVAILABLE" : "STARTING"}
          </span>
        )}

        {phase === "live" ? (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            className="inline-flex items-center gap-2 text-[13px] text-white/45 transition-colors hover:text-white/80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Flip
          </button>
        ) : (
          <span className="w-14" aria-hidden />
        )}
      </div>
    </div>
  );
}
