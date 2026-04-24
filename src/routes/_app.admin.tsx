import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMeters, updateMeter, addMeter, deleteMeter, type Meter } from "@/lib/metersStore";
import { getReadings } from "@/lib/readings";
import { getSession, logout } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plane,
  LogOut,
  Gauge,
  CheckCircle2,
  Clock,
  Search,
  Pencil,
  Calendar,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Airport Meter Reading" },
      { name: "description", content: "Manage meter master list and review submitted readings." },
    ],
  }),
  component: AdminPage,
});

function isSameDate(iso: string, ymd: string) {
  const d = new Date(iso);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return local === ymd;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AdminPage() {
  const navigate = useNavigate();
  const session = getSession();
  const meters = useMeters();
  const readings = getReadings();
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState<string>(todayYmd());
  const [dateTo, setDateTo] = useState<string>(todayYmd());
  const [locationFilter, setLocationFilter] = useState<string>("__all__");
  const [editing, setEditing] = useState<Meter | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingMeter, setDeletingMeter] = useState<Meter | null>(null);

  const inRange = (iso: string) => {
    const d = new Date(iso);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return local >= dateFrom && local <= dateTo;
  };

  const locations = useMemo(
    () => Array.from(new Set(meters.map((m) => m.location).filter(Boolean))).sort(),
    [meters],
  );

  const stats = useMemo(() => {
    const inLoc = (mid: string) => {
      if (locationFilter === "__all__") return true;
      const m = meters.find((x) => x.id === mid);
      return m?.location === locationFilter;
    };
    const totalMeters =
      locationFilter === "__all__"
        ? meters.length
        : meters.filter((m) => m.location === locationFilter).length;
    const takenInRange = new Set(
      readings.filter((r) => inRange(r.submittedAt) && inLoc(r.meterId)).map((r) => r.meterId),
    );
    return {
      total: totalMeters,
      taken: takenInRange.size,
      pending: totalMeters - takenInRange.size,
      takenAllTime: new Set(readings.filter((r) => inLoc(r.meterId)).map((r) => r.meterId)).size,
    };
  }, [meters, readings, dateFrom, dateTo, locationFilter]);

  const meterRows = useMemo(() => {
    const lastByMeter = new Map<string, string>();
    for (const r of readings) {
      if (!lastByMeter.has(r.meterId)) lastByMeter.set(r.meterId, r.submittedAt);
    }
    const term = q.trim().toLowerCase();
    return meters
      .filter((m) => locationFilter === "__all__" || m.location === locationFilter)
      .filter((m) => {
        if (!term) return true;
        return (
          m.concessioner.toLowerCase().includes(term) ||
          m.meterSrNo.toLowerCase().includes(term) ||
          m.location.toLowerCase().includes(term) ||
          m.unitNo.toLowerCase().includes(term) ||
          m.substation.toLowerCase().includes(term)
        );
      })
      .map((m) => {
        const last = lastByMeter.get(m.id);
        return {
          ...m,
          lastReadingAt: last,
          doneInRange: !!last && inRange(last),
        };
      });
  }, [q, readings, meters, dateFrom, dateTo, locationFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Plane className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight leading-tight">
                Admin Dashboard
              </h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {session?.username} · Admin
              </p>
            </div>
          </div>
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
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Date range + location filter */}
        <Card className="bg-card border-border p-4 shadow-card flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-primary" /> From date
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-input border-border h-10"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-primary" /> To date
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-input border-border h-10"
            />
          </div>
          <div className="flex flex-col gap-1 lg:min-w-[220px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Location
            </Label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="bg-input border-border h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom(todayYmd());
              setDateTo(todayYmd());
              setLocationFilter("__all__");
            }}
            className="text-xs"
          >
            Reset
          </Button>
          <p className="text-xs text-muted-foreground lg:ml-auto font-mono">
            {dateFrom === dateTo
              ? new Date(dateFrom).toLocaleDateString()
              : `${new Date(dateFrom).toLocaleDateString()} → ${new Date(dateTo).toLocaleDateString()}`}
          </p>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<Gauge className="w-5 h-5" />}
            label="Total Meters"
            value={stats.total}
            tone="primary"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Readings Taken"
            value={stats.taken}
            tone="success"
            sub={`${stats.takenAllTime} all-time`}
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Pending"
            value={stats.pending}
            tone="warning"
          />
        </div>

        {/* Master meter list */}
        <Card className="bg-card border-border p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Master Meter List</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meterRows.length} of {meters.length} meters · admin can edit
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search meter, concessioner, location…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 bg-input border-border h-10"
                />
              </div>
              <Button
                onClick={() => setAdding(true)}
                className="bg-gradient-primary text-primary-foreground h-10 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider">
                    Meter Sr.
                  </TableHead>
                  <TableHead>Concessioner</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Substation</TableHead>
                  <TableHead className="text-right">MF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meterRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No meters match your search.
                    </TableCell>
                  </TableRow>
                )}
                {meterRows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.meterSrNo}</TableCell>
                    <TableCell className="font-medium">{m.concessioner}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.location} · {m.outletFloor}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.unitNo}</TableCell>
                    <TableCell className="font-mono text-xs">{m.substation}</TableCell>
                    <TableCell className="text-right font-mono">{m.mf}</TableCell>
                    <TableCell>
                      {m.doneInRange ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/15 border-success/30">
                          Done
                        </Badge>
                      ) : m.lastReadingAt ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Never
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(m)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingMeter(m)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>

      <EditMeterDialog meter={editing} onClose={() => setEditing(null)} />
      <AddMeterDialog open={adding} onClose={() => setAdding(false)} />
      <AlertDialog open={!!deletingMeter} onOpenChange={(o) => !o && setDeletingMeter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meter?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMeter && (
                <>
                  <span className="font-mono">{deletingMeter.meterSrNo}</span> ·{" "}
                  {deletingMeter.concessioner}
                  <br />
                  This will permanently remove it from the master list.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingMeter) {
                  deleteMeter(deletingMeter.id);
                  toast.success("Meter deleted");
                  setDeletingMeter(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddMeterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty: Omit<Meter, "id"> = {
    concessioner: "",
    substation: "",
    unitNo: "",
    outletFloor: "",
    location: "",
    panelFloor: "",
    tenantPanel: "",
    fdrNo: "",
    meterSrNo: "",
    mf: 1,
    prevKwh: 0,
    prevKvah: 0,
  };
  const [form, setForm] = useState<Omit<Meter, "id">>(empty);

  useMemo(() => {
    if (open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof Omit<Meter, "id">, v: string | number) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const save = () => {
    if (!form.meterSrNo.trim() || !form.concessioner.trim()) {
      toast.error("Meter Sr. No. and Concessioner are required");
      return;
    }
    addMeter(form);
    toast.success("Meter added");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new meter</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <Field
            label="Meter Sr. No."
            value={form.meterSrNo}
            onChange={(v) => set("meterSrNo", v)}
          />
          <Field
            label="MF"
            type="number"
            value={String(form.mf)}
            onChange={(v) => set("mf", parseFloat(v) || 0)}
          />
          <Field
            label="Concessioner"
            value={form.concessioner}
            onChange={(v) => set("concessioner", v)}
            className="col-span-2"
          />
          <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
          <Field
            label="Outlet Floor"
            value={form.outletFloor}
            onChange={(v) => set("outletFloor", v)}
          />
          <Field label="Unit No." value={form.unitNo} onChange={(v) => set("unitNo", v)} />
          <Field
            label="Substation"
            value={form.substation}
            onChange={(v) => set("substation", v)}
          />
          <Field
            label="Panel Floor"
            value={form.panelFloor}
            onChange={(v) => set("panelFloor", v)}
          />
          <Field
            label="Tenant Panel"
            value={form.tenantPanel}
            onChange={(v) => set("tenantPanel", v)}
          />
          <Field label="FDR No." value={form.fdrNo} onChange={(v) => set("fdrNo", v)} />
          <Field
            label="Prev KWh"
            type="number"
            value={String(form.prevKwh)}
            onChange={(v) => set("prevKwh", parseFloat(v) || 0)}
          />
          <Field
            label="Prev kVAh"
            type="number"
            value={String(form.prevKvah)}
            onChange={(v) => set("prevKvah", parseFloat(v) || 0)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground">
            Add meter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMeterDialog({ meter, onClose }: { meter: Meter | null; onClose: () => void }) {
  const [form, setForm] = useState<Meter | null>(meter);

  // reset form when meter changes
  useMemo(() => {
    setForm(meter);
  }, [meter]);

  const set = (k: keyof Meter, v: string | number) => {
    if (!form) return;
    setForm({ ...form, [k]: v });
  };

  const save = () => {
    if (!form) return;
    updateMeter(form.id, form);
    toast.success("Meter updated");
    onClose();
  };

  return (
    <Dialog open={!!meter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit meter</DialogTitle>
        </DialogHeader>
        {form && (
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <Field
              label="Meter Sr. No."
              value={form.meterSrNo}
              onChange={(v) => set("meterSrNo", v)}
            />
            <Field
              label="MF"
              type="number"
              value={String(form.mf)}
              onChange={(v) => set("mf", parseFloat(v) || 0)}
            />
            <Field
              label="Concessioner"
              value={form.concessioner}
              onChange={(v) => set("concessioner", v)}
              className="col-span-2"
            />
            <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
            <Field
              label="Outlet Floor"
              value={form.outletFloor}
              onChange={(v) => set("outletFloor", v)}
            />
            <Field label="Unit No." value={form.unitNo} onChange={(v) => set("unitNo", v)} />
            <Field
              label="Substation"
              value={form.substation}
              onChange={(v) => set("substation", v)}
            />
            <Field
              label="Panel Floor"
              value={form.panelFloor}
              onChange={(v) => set("panelFloor", v)}
            />
            <Field
              label="Tenant Panel"
              value={form.tenantPanel}
              onChange={(v) => set("tenantPanel", v)}
            />
            <Field label="FDR No." value={form.fdrNo} onChange={(v) => set("fdrNo", v)} />
            <Field
              label="Prev KWh"
              type="number"
              value={String(form.prevKwh)}
              onChange={(v) => set("prevKwh", parseFloat(v) || 0)}
            />
            <Field
              label="Prev kVAh"
              type="number"
              value={String(form.prevKvah)}
              onChange={(v) => set("prevKvah", parseFloat(v) || 0)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input border-border h-9 text-sm"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning";
  sub?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success/10 border-success/30"
      : tone === "warning"
        ? "text-runway bg-runway/10 border-runway/30"
        : "text-primary bg-primary/10 border-primary/30";
  return (
    <Card className="bg-card border-border p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${toneClass}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-mono font-bold mt-3">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</p>}
    </Card>
  );
}
