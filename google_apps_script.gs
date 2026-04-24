/**
 * NMIA Airport Meter Reading — Google Apps Script Backend
 * ---------------------------------------------------------
 * Stores: Master meter list + submitted readings (with photo in Drive)
 *
 * SETUP (one time):
 * 1. Open Google Drive → New → Google Sheets. Name it e.g. "NMIA Meter Readings".
 * 2. Extensions → Apps Script. Delete any code, paste THIS file, save.
 * 3. In the Apps Script editor, click ▶ Run → choose function `setup` → Authorize.
 *    This creates the "Meters" and "Readings" tabs with correct headers,
 *    and a Drive folder called "NMIA Meter Photos" for uploaded images.
 * 4. Click Deploy → New deployment → type: Web app
 *      • Description: NMIA Meter API
 *      • Execute as: Me
 *      • Who has access: Anyone
 *    Click Deploy, copy the Web app URL (ends in /exec).
 * 5. Paste that URL into the app (it will be wired to POST submissions).
 *
 * SHEET STRUCTURE
 * ===============
 * Tab "Meters" (master list — admin editable, one row per meter):
 *   id | meterSrNo | concessioner | location | outletFloor | unitNo |
 *   substation | panelFloor | tenantPanel | fdrNo | mf | prevKwh | prevKvah | updatedAt
 *
 * Tab "Readings" (one row per submission, append-only log):
 *   readingId | submittedAt | submittedBy | meterId | meterSrNo | concessioner |
 *   location | outletFloor | unitNo | substation | fdrNo | mf |
 *   prevKwh | prevKvah | currKwh | currKvah | consumptionKwh | consumptionKvah |
 *   photoUrl
 *
 * API (POST JSON to the Web app URL)
 * ===================================
 *  { action: "listMeters" }
 *      → { ok: true, meters: [...] }
 *
 *  { action: "upsertMeter", meter: { id?, meterSrNo, concessioner, ... } }
 *      → { ok: true, meter: {...} }       (creates if id missing/unknown)
 *
 *  { action: "deleteMeter", id: "m123" }
 *      → { ok: true }
 *
 *  { action: "submitReading", reading: {
 *        meterId, meterSrNo, concessioner, location, unitNo,
 *        prevKwh, prevKvah, currKwh, currKvah, mf,
 *        consumptionKwh, consumptionKvah,
 *        submittedBy, photoDataUrl   // data:image/jpeg;base64,....
 *      } }
 *      → { ok: true, readingId, photoUrl }
 *
 *  { action: "listReadings", from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }
 *      → { ok: true, readings: [...] }
 */

const METERS_SHEET = "Meters";
const READINGS_SHEET = "Readings";
const PHOTO_FOLDER = "NMIA Meter Photos";

const METER_HEADERS = [
  "id",
  "meterSrNo",
  "concessioner",
  "location",
  "outletFloor",
  "unitNo",
  "substation",
  "panelFloor",
  "tenantPanel",
  "fdrNo",
  "mf",
  "prevKwh",
  "prevKvah",
  "updatedAt",
];

const READING_HEADERS = [
  "readingId",
  "submittedAt",
  "submittedBy",
  "meterId",
  "meterSrNo",
  "concessioner",
  "location",
  "outletFloor",
  "unitNo",
  "substation",
  "fdrNo",
  "mf",
  "prevKwh",
  "prevKvah",
  "currKwh",
  "currKvah",
  "consumptionKwh",
  "consumptionKvah",
  "photoUrl",
];

/* =============================================================
 * SETUP — run once from the editor
 * ============================================================= */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, METERS_SHEET, METER_HEADERS);
  ensureSheet_(ss, READINGS_SHEET, READING_HEADERS);
  ensurePhotoFolder_();
  SpreadsheetApp.getUi &&
    SpreadsheetApp.getUi().alert(
      "Setup complete.\n• Sheets ready: Meters, Readings\n• Photo folder: " +
        PHOTO_FOLDER +
        "\n\nNow Deploy → New deployment → Web app.",
    );
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function ensurePhotoFolder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

/* =============================================================
 * HTTP entry points
 * ============================================================= */
function doGet(e) {
  return jsonOut_({ ok: true, message: "NMIA Meter API alive" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    switch (action) {
      case "listMeters":
        return jsonOut_({ ok: true, meters: listMeters_() });
      case "upsertMeter":
        return jsonOut_({ ok: true, meter: upsertMeter_(body.meter) });
      case "deleteMeter":
        return jsonOut_({ ok: true, deleted: deleteMeter_(body.id) });
      case "submitReading":
        return jsonOut_(submitReading_(body.reading));
      case "listReadings":
        return jsonOut_({ ok: true, readings: listReadings_(body.from, body.to) });
      default:
        return jsonOut_({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String((err && err.message) || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* =============================================================
 * METERS
 * ============================================================= */
function listMeters_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(METERS_SHEET);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values
    .slice(1)
    .filter((r) => r[0])
    .map((r) => rowToObj_(headers, r));
}

function upsertMeter_(meter) {
  if (!meter || !meter.meterSrNo) throw new Error("meter.meterSrNo is required");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(METERS_SHEET);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("id");

  let rowIndex = -1;
  if (meter.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === meter.id) {
        rowIndex = i;
        break;
      }
    }
  }
  if (rowIndex === -1) {
    if (!meter.id) meter.id = "m" + Date.now();
    meter.updatedAt = new Date().toISOString();
    const row = headers.map((h) => (meter[h] !== undefined ? meter[h] : ""));
    sh.appendRow(row);
  } else {
    const existing = rowToObj_(headers, data[rowIndex]);
    const merged = Object.assign(existing, meter, { updatedAt: new Date().toISOString() });
    const row = headers.map((h) => (merged[h] !== undefined ? merged[h] : ""));
    sh.getRange(rowIndex + 1, 1, 1, headers.length).setValues([row]);
  }
  return meter;
}

function deleteMeter_(id) {
  if (!id) throw new Error("id is required");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(METERS_SHEET);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/* =============================================================
 * READINGS
 * ============================================================= */
function submitReading_(r) {
  if (!r || !r.meterSrNo) throw new Error("reading.meterSrNo is required");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(READINGS_SHEET);

  // pull master meter to enrich missing fields
  const master =
    listMeters_().find((m) => (r.meterId && m.id === r.meterId) || m.meterSrNo === r.meterSrNo) ||
    {};

  const readingId = "r" + Date.now();
  const submittedAt = new Date().toISOString();
  const photoUrl = r.photoDataUrl ? savePhoto_(readingId, r.meterSrNo, r.photoDataUrl) : "";

  const row = {
    readingId,
    submittedAt,
    submittedBy: r.submittedBy || "",
    meterId: r.meterId || master.id || "",
    meterSrNo: r.meterSrNo,
    concessioner: r.concessioner || master.concessioner || "",
    location: r.location || master.location || "",
    outletFloor: master.outletFloor || "",
    unitNo: r.unitNo || master.unitNo || "",
    substation: master.substation || "",
    fdrNo: master.fdrNo || "",
    mf: r.mf != null ? r.mf : master.mf || 1,
    prevKwh: r.prevKwh != null ? r.prevKwh : master.prevKwh || 0,
    prevKvah: r.prevKvah != null ? r.prevKvah : master.prevKvah || 0,
    currKwh: r.currKwh || 0,
    currKvah: r.currKvah || 0,
    consumptionKwh: r.consumptionKwh || 0,
    consumptionKvah: r.consumptionKvah || 0,
    photoUrl,
  };

  sh.appendRow(READING_HEADERS.map((h) => (row[h] !== undefined ? row[h] : "")));
  return { ok: true, readingId, photoUrl };
}

function listReadings_(from, to) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(READINGS_SHEET);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  let rows = values
    .slice(1)
    .filter((r) => r[0])
    .map((r) => rowToObj_(headers, r));
  if (from) rows = rows.filter((r) => r.submittedAt >= from);
  if (to) rows = rows.filter((r) => r.submittedAt <= to + "T23:59:59");
  return rows;
}

/* =============================================================
 * PHOTO HANDLING
 * ============================================================= */
function savePhoto_(readingId, meterSrNo, dataUrl) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return "";
  const contentType = m[1];
  const bytes = Utilities.base64Decode(m[2]);
  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const blob = Utilities.newBlob(bytes, contentType, `${meterSrNo}_${readingId}.${ext}`);
  const file = ensurePhotoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/* =============================================================
 * Helpers
 * ============================================================= */
function rowToObj_(headers, row) {
  const o = {};
  headers.forEach((h, i) => {
    o[h] = row[i];
  });
  return o;
}
