// Mutable meter master list — Google Sheets backed, with localStorage cache + seed.
import { useEffect, useState, useCallback } from "react";
import { METERS as SEED, type Meter } from "@/data/meters";
import { sheetsApi, type SheetMeter } from "@/lib/sheetsApi";

const KEY = "nmia_meters_master";

export type { Meter };

function loadCached(): Meter[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Meter[];
  } catch {
    /* fallthrough */
  }
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
}

let cache: Meter[] | null = null;
const listeners = new Set<() => void>();

function persist() {
  if (cache && typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

export function getMeters(): Meter[] {
  if (!cache) cache = loadCached();
  return cache;
}

function toMeter(m: SheetMeter): Meter {
  return {
    id: m.id,
    concessioner: m.concessioner ?? "",
    substation: m.substation ?? "",
    unitNo: m.unitNo ?? "",
    outletFloor: m.outletFloor ?? "",
    location: m.location ?? "",
    panelFloor: m.panelFloor ?? "",
    tenantPanel: m.tenantPanel ?? "",
    fdrNo: m.fdrNo ?? "",
    meterSrNo: m.meterSrNo ?? "",
    mf: Number(m.mf) || 1,
    prevKwh: Number(m.prevKwh) || 0,
    prevKvah: Number(m.prevKvah) || 0,
  };
}

let refreshing = false;
export async function refreshMetersFromSheet() {
  if (refreshing) return;
  refreshing = true;
  try {
    const remote = await sheetsApi.listMeters();
    if (remote && remote.length > 0) {
      cache = remote.map(toMeter);
      persist();
    } else {
      // Sheet empty → seed it from local data once
      const seeded = getMeters();
      await Promise.all(seeded.map((m) => sheetsApi.upsertMeter(m)));
    }
  } catch (e) {
    console.warn("[metersStore] sheet refresh failed, using cache:", e);
  } finally {
    refreshing = false;
  }
}

export function updateMeter(id: string, patch: Partial<Meter>) {
  const all = getMeters();
  const next = all.map((m) => (m.id === id ? { ...m, ...patch } : m));
  cache = next;
  persist();
  const updated = next.find((m) => m.id === id);
  if (updated) sheetsApi.upsertMeter(updated).catch((e) => console.warn("upsert failed", e));
}

export function addMeter(m: Omit<Meter, "id">) {
  const all = getMeters();
  const id = `m${Date.now()}`;
  const created: Meter = { ...m, id };
  cache = [...all, created];
  persist();
  sheetsApi.upsertMeter(created).catch((e) => console.warn("upsert failed", e));
}

export function deleteMeter(id: string) {
  const all = getMeters();
  cache = all.filter((m) => m.id !== id);
  persist();
  sheetsApi.deleteMeter(id).catch((e) => console.warn("delete failed", e));
}

export function resetMeters() {
  cache = SEED.map((m) => ({ ...m }));
  persist();
}

export function useMeters() {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    listeners.add(rerender);
    refreshMetersFromSheet();
    return () => {
      listeners.delete(rerender);
    };
  }, [rerender]);
  return getMeters();
}
