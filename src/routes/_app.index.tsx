import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMeters, type Meter } from "@/lib/metersStore";
import { getSession, logout } from "@/lib/auth";
import { saveReading, getReadings, latestReadingFor, type Reading } from "@/lib/readings";
import { sheetsApi } from "@/lib/sheetsApi";
import { FilterStep } from "@/components/FilterStep";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plane, LogOut, Zap, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  beforeLoad: async () => {
    const session = getSession();
    if (session?.role === "admin") {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({
    meta: [
      { title: "Take Reading — Airport Meter Reading" },
      {
        name: "description",
        content: "Capture concessioner electric meter readings with photo evidence.",
      },
    ],
  }),
  component: DashboardPage,
});

const FILTER_KEYS = [
  { key: "concessioner", label: "Shop / Concessioner Name" },
  { key: "meterSrNo", label: "Meter Sr. No." },
] as const;

type FilterKey = (typeof FILTER_KEYS)[number]["key"];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v !== undefined && v !== null))).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const METERS = useMeters();
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    concessioner: "",
    meterSrNo: "",
  });
  const [currKwh, setCurrKwh] = useState("");
  const [currKvah, setCurrKvah] = useState("");
  const [photo, setPhoto] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter meters progressively
  const filteredAt = (upToIdx: number): Meter[] => {
    return METERS.filter((m) => {
      for (let i = 0; i < upToIdx; i++) {
        const k = FILTER_KEYS[i].key;
        if (filters[k] && String(m[k]) !== filters[k]) return false;
      }
      return true;
    });
  };

  const optionsFor = (idx: number): string[] => {
    const pool = filteredAt(idx);
    const k = FILTER_KEYS[idx].key;
    return uniqueSorted(pool.map((m) => String(m[k] ?? "")));
  };

  const selectedMeter: Meter | undefined = useMemo(() => {
    const candidates = METERS.filter((m) =>
      FILTER_KEYS.every(({ key }) => !filters[key] || String(m[key]) === filters[key]),
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  }, [filters]);

  const previousReading = useMemo(() => {
    if (!selectedMeter) return null;
    const last = latestReadingFor(selectedMeter.id);
    return {
      kwh: last?.currKwh ?? selectedMeter.prevKwh,
      kvah: last?.currKvah ?? selectedMeter.prevKvah,
      mf: selectedMeter.mf,
      source: last ? "last submission" : "master / HOTO",
    };
  }, [selectedMeter]);

  const consumption = useMemo(() => {
    if (!previousReading) return null;
    const ck = parseFloat(currKwh);
    const cv = parseFloat(currKvah);
    return {
      kwh: !isNaN(ck) ? +((ck - previousReading.kwh) * previousReading.mf).toFixed(3) : null,
      kvah: !isNaN(cv) ? +((cv - previousReading.kvah) * previousReading.mf).toFixed(3) : null,
    };
  }, [currKwh, currKvah, previousReading]);

  const setFilter = (idx: number, value: string) => {
    const updated = { ...filters, [FILTER_KEYS[idx].key]: value };
    // reset downstream
    for (let i = idx + 1; i < FILTER_KEYS.length; i++) {
      updated[FILTER_KEYS[i].key] = "";
    }
    setFilters(updated);
  };

  const resetForm = () => {
    setFilters({ concessioner: "", meterSrNo: "" });
    setCurrKwh("");
    setCurrKvah("");
    setPhoto("");
  };

  const handleSubmit = async () => {
    if (!selectedMeter || !previousReading) {
      toast.error("Select a meter first");
      return;
    }
    if (!currKwh || !currKvah) {
      toast.error("Enter both KWh and kVAh readings");
      return;
    }
    if (!photo) {
      toast.error("Meter photo is required");
      return;
    }
    const ck = parseFloat(currKwh);
    const cv = parseFloat(currKvah);
    if (ck < previousReading.kwh) {
      toast.error("Current KWh is lower than previous — please verify");
      return;
    }
    setSubmitting(true);
    const reading: Reading = {
      id: crypto.randomUUID(),
      meterId: selectedMeter.id,
      meterSrNo: selectedMeter.meterSrNo,
      concessioner: selectedMeter.concessioner,
      location: selectedMeter.location,
      unitNo: selectedMeter.unitNo,
      prevKwh: previousReading.kwh,
      prevKvah: previousReading.kvah,
      currKwh: ck,
      currKvah: cv,
      mf: previousReading.mf,
      consumptionKwh: consumption!.kwh!,
      consumptionKvah: consumption!.kvah!,
      photoDataUrl: photo,
      submittedAt: new Date().toISOString(),
      submittedBy: session?.username ?? "unknown",
    };
    saveReading(reading);
    try {
      await sheetsApi.submitReading({
        meterId: reading.meterId,
        meterSrNo: reading.meterSrNo,
        concessioner: reading.concessioner,
        location: reading.location,
        unitNo: reading.unitNo,
        prevKwh: reading.prevKwh,
        prevKvah: reading.prevKvah,
        currKwh: reading.currKwh,
        currKvah: reading.currKvah,
        mf: reading.mf,
        consumptionKwh: reading.consumptionKwh,
        consumptionKvah: reading.consumptionKvah,
        submittedBy: reading.submittedBy,
        photoDataUrl: reading.photoDataUrl,
      });
      toast.success("Reading submitted", {
        description: `${selectedMeter.concessioner} · ${consumption!.kwh} kWh · saved to Google Sheet`,
      });
    } catch (err: any) {
      toast.warning("Saved locally, sync failed", {
        description: err?.message ?? "Could not reach Google Sheet",
      });
    }
    setSubmitting(false);
    resetForm();
  };

  const recent = getReadings().slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Plane className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight leading-tight">Meter Reading</h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {session?.username} · Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Filter cascade */}
        <Card className="bg-card border-border p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Select Meter</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Filter step by step to find the meter
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FILTER_KEYS.map(({ key, label }, idx) => {
              const opts = optionsFor(idx);
              const prevFilled = idx === 0 || filters[FILTER_KEYS[idx - 1].key];
              return (
                <FilterStep
                  key={key}
                  step={idx + 1}
                  label={label}
                  value={filters[key]}
                  options={opts}
                  onChange={(v) => setFilter(idx, v)}
                  disabled={!prevFilled || opts.length === 0}
                />
              );
            })}
          </div>

          {selectedMeter && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Meter locked: <strong className="font-mono">{selectedMeter.meterSrNo}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border text-xs">
                <Detail k="Location" v={selectedMeter.location} />
                <Detail k="Outlet Floor" v={selectedMeter.outletFloor} />
                <Detail k="Unit No." v={selectedMeter.unitNo} />
                <Detail k="Substation" v={selectedMeter.substation} />
                <Detail k="Panel Floor" v={selectedMeter.panelFloor} />
                <Detail k="Tenant Panel" v={selectedMeter.tenantPanel} />
                <Detail k="FDR No." v={selectedMeter.fdrNo} />
                <Detail k="MF" v={String(selectedMeter.mf)} />
              </div>
            </div>
          )}
        </Card>

        {/* Reading entry */}
        {selectedMeter && previousReading && (
          <Card className="bg-card border-border p-5 shadow-card space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Reading
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                MF × {previousReading.mf}
              </span>
            </div>

            {/* Previous readings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Previous KWh
                </p>
                <p className="text-xl font-mono font-semibold mt-1">
                  {previousReading.kwh.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Previous kVAh
                </p>
                <p className="text-xl font-mono font-semibold mt-1">
                  {previousReading.kvah.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Current readings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current KWh *
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  value={currKwh}
                  onChange={(e) => setCurrKwh(e.target.value)}
                  placeholder="0.00"
                  className="bg-input border-border h-11 font-mono text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current kVAh *
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  value={currKvah}
                  onChange={(e) => setCurrKvah(e.target.value)}
                  placeholder="0.00"
                  className="bg-input border-border h-11 font-mono text-base"
                />
              </div>
            </div>

            {/* Auto consumption */}
            {consumption && (consumption.kwh !== null || consumption.kvah !== null) && (
              <div className="p-3 rounded-lg bg-gradient-primary/10 border border-primary/30">
                <p className="text-[10px] uppercase tracking-wider text-primary font-mono">
                  Auto Consumption
                </p>
                <div className="flex gap-6 mt-1">
                  <div>
                    <span className="text-xs text-muted-foreground">KWh</span>
                    <p
                      className={`text-xl font-mono font-bold ${consumption.kwh !== null && consumption.kwh < 0 ? "text-destructive" : "text-runway"}`}
                    >
                      {consumption.kwh ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">kVAh</span>
                    <p
                      className={`text-xl font-mono font-bold ${consumption.kvah !== null && consumption.kvah < 0 ? "text-destructive" : "text-runway"}`}
                    >
                      {consumption.kvah ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Photo */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Meter Photo *
              </Label>
              <PhotoCapture value={photo} onChange={setPhoto} />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !currKwh || !currKvah || !photo}
              className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold tracking-wide shadow-glow hover:opacity-90 transition-smooth"
            >
              {submitting ? "Submitting…" : "Submit Reading"}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Date & time will be stamped automatically
            </p>
          </Card>
        )}

        {/* Recent submissions */}
        {recent.length > 0 && (
          <Card className="bg-card border-border p-5 shadow-card">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Recent submissions
            </h2>
            <div className="space-y-2">
              {recent.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.concessioner}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {new Date(r.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-runway">
                      {r.consumptionKwh} kWh
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.meterSrNo}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="font-mono text-foreground truncate">{v || "—"}</p>
    </div>
  );
}
