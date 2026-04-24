// Google Apps Script Web App endpoint (deployed from google_apps_script.gs)
export const SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwN3TFaYKAoZ3KLYGpngQUlWC0RZ0whBbS8dkMsTUYYyftN1iOqalx-w5A1k51B5w3R/exec";

/**
 * Apps Script Web Apps reject CORS preflights. To avoid them, we POST as
 * text/plain — Apps Script still parses e.postData.contents as JSON.
 */
async function call<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const res = await fetch(SHEETS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
    redirect: "follow",
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Sheets API: invalid JSON (status ${res.status})`);
  }
  if (!data.ok) throw new Error(data.error || "Sheets API error");
  return data as T;
}

export interface SheetMeter {
  id: string;
  meterSrNo: string;
  concessioner: string;
  location: string;
  outletFloor: string;
  unitNo: string;
  substation: string;
  panelFloor: string;
  tenantPanel: string;
  fdrNo: string;
  mf: number;
  prevKwh: number;
  prevKvah: number;
  updatedAt?: string;
}

export const sheetsApi = {
  listMeters: () => call<{ ok: true; meters: SheetMeter[] }>("listMeters").then((r) => r.meters),
  upsertMeter: (meter: Partial<SheetMeter>) =>
    call<{ ok: true; meter: SheetMeter }>("upsertMeter", { meter }).then((r) => r.meter),
  deleteMeter: (id: string) => call<{ ok: true }>("deleteMeter", { id }),
  submitReading: (reading: {
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
    submittedBy: string;
    photoDataUrl: string;
  }) => call<{ ok: true; readingId: string; photoUrl: string }>("submitReading", { reading }),
};
