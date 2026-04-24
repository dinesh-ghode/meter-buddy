// Local store for submitted readings (will be swapped for Google Sheets API later).
export interface Reading {
  id: string;
  meterId: string;
  meterSrNo: string;
  concessioner: string;
  location: string;
  unitNo: string;
  prevKwh: number;
  prevKvah: number;
  currKwh: number;
  currKvah: number;
  mf: number;
  consumptionKwh: number;
  consumptionKvah: number;
  photoDataUrl: string;
  submittedAt: string;
  submittedBy: string;
}

const KEY = "nmia_meter_readings";

export function getReadings(): Reading[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Reading[]) : [];
  } catch {
    return [];
  }
}

export function saveReading(r: Reading) {
  const all = getReadings();
  all.unshift(r);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function latestReadingFor(meterId: string): Reading | undefined {
  return getReadings().find((r) => r.meterId === meterId);
}
