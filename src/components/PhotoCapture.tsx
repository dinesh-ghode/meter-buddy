import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (dataUrl: string) => void;
}

/**
 * Live meter photo capture.
 * Primary: getUserMedia (rear camera). Fallback: native camera via <input capture>.
 */
export function PhotoCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const attachStream = async (stream: MediaStream) => {
    streamRef.current = stream;
    setActive(true);
    // Wait a tick for the <video> element to mount
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    try {
      await video.play();
    } catch {
      // some browsers need a user gesture; ignore
    }
  };

  const startCamera = () => {
    setError("");
    // Pre-flight checks (sync) — do NOT await before getUserMedia
    if (!window.isSecureContext) {
      setError('Camera needs HTTPS. Use "Use device camera" below.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API unavailable. Use "Use device camera" below.');
      return;
    }
    setStarting(true);
    // Call getUserMedia SYNCHRONOUSLY in the gesture — keep the promise chain
    // attached so iOS/Safari/Vercel-embedded contexts treat it as user-initiated.
    const req = navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

    req
      .then((stream) => attachStream(stream))
      .catch((e: unknown) => {
        const err = e as DOMException;
        let msg = err?.message || "Could not access camera";
        if (err?.name === "NotAllowedError")
          msg = "Camera permission denied. Allow camera in browser settings.";
        else if (err?.name === "NotFoundError") msg = "No camera found on this device.";
        else if (err?.name === "NotReadableError") msg = "Camera is in use by another app.";
        else if (err?.name === "SecurityError") msg = "Camera blocked by site permissions policy.";
        setError(`${msg} Tap "Use device camera" below.`);
        stopCamera();
      })
      .finally(() => setStarting(false));
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera not ready yet — wait a moment and tap Capture again");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to capture frame");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onChange(dataUrl);
    stopCamera();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onChange(result);
    };
    reader.onerror = () => setError("Failed to read photo");
    reader.readAsDataURL(file);
    // reset so same file can be retaken
    e.target.value = "";
  };

  useEffect(() => () => stopCamera(), []);

  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-border shadow-card">
          <img src={value} alt="Meter reading capture" className="w-full h-56 object-cover" />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onChange("");
                startCamera();
              }}
              className="h-8 px-2 backdrop-blur"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retake
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange("")}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {active ? (
        <div className="relative rounded-xl overflow-hidden border border-border shadow-card bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-56 object-cover bg-black"
          />
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={stopCamera}
              className="h-9 px-3 backdrop-blur"
            >
              <CameraOff className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={capture}
              className="h-9 px-4 bg-gradient-primary text-primary-foreground"
            >
              <Camera className="w-4 h-4 mr-1" /> Capture
            </Button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={startCamera}
            disabled={starting}
            className="w-full h-32 rounded-xl border-2 border-dashed border-border bg-input/50 hover:border-primary hover:bg-input transition-smooth flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            <Camera className="w-7 h-7" />
            <span className="text-sm font-medium">
              {starting ? "Starting camera…" : "Open in-app camera"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-11 rounded-xl border border-border bg-muted/30 hover:bg-muted flex items-center justify-center gap-2 text-sm text-foreground transition-smooth"
          >
            <Camera className="w-4 h-4" /> Use device camera
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
