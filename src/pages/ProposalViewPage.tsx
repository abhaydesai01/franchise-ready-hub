import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "signature_pad";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const apiBase =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001/api/v1";

function apiOrigin(): string {
  return apiBase.replace(/\/api\/v1$/i, "");
}

function absolutePdfUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = apiOrigin();
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

type ViewMeta = {
  pdfUrl: string;
  leadFirstName: string;
  companyName: string;
  alreadySigned: boolean;
};

export default function ProposalViewPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ViewMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signedOk, setSignedOk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/proposals/view-meta/${encodeURIComponent(token)}`);
        if (!res.ok) {
          setError("Proposal not found or link expired.");
          return;
        }
        const data = (await res.json()) as ViewMeta;
        if (!cancelled) setMeta(data);
      } catch {
        if (!cancelled) setError("Could not load proposal.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !meta) return;
    void fetch(`${apiBase}/proposals/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [token, meta]);

  useEffect(() => {
    if (!signOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255,255,255)",
      penColor: "rgb(15,23,42)",
    });
    padRef.current = pad;
    return () => {
      pad.clear();
      padRef.current = null;
    };
  }, [signOpen]);

  async function submitSignature() {
    const pad = padRef.current;
    const t = token;
    if (!pad || pad.isEmpty() || !t) return;
    const dataUrl = pad.toDataURL("image/png");
    const res = await fetch(`${apiBase}/proposals/sign/${encodeURIComponent(t)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signaturePngBase64: dataUrl }),
    });
    if (!res.ok) {
      const msg = await res.text();
      toast.error(msg || "Could not save signature");
      return;
    }
    setSignOpen(false);
    setSignedOk(true);
    setMeta((m) => (m ? { ...m, alreadySigned: true } : m));
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const showSign = !meta.alreadySigned && !signedOk;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-[13px] text-slate-600">
          Hi {meta.leadFirstName} — proposal from{" "}
          <span className="font-semibold text-slate-900">{meta.companyName}</span>
        </p>
      </header>
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 gap-4">
        <div className="flex-1 min-h-[70vh] rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          <iframe
            title="Proposal PDF"
            src={absolutePdfUrl(meta.pdfUrl)}
            className="w-full h-[70vh] border-0"
          />
        </div>
        {signedOk && (
          <p className="text-sm text-green-700 font-medium">
            Thank you — your signed proposal has been received.
          </p>
        )}
        {showSign && (
          <div className="flex justify-center">
            <Button type="button" onClick={() => setSignOpen(true)} className="gap-2">
              Sign this proposal
            </Button>
          </div>
        )}
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign below</DialogTitle>
          </DialogHeader>
          <div className="border border-slate-200 rounded-md bg-white">
            <canvas ref={canvasRef} className="w-full h-48 touch-none cursor-crosshair" />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => padRef.current?.clear()}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() =>
                void submitSignature().catch((e: Error) =>
                  toast.error(e.message || "Could not save signature"),
                )
              }
            >
              Submit signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
