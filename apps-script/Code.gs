/**
 * Wedding RSVP backend (Google Apps Script).
 *
 * This code lives inside the Google Sheet (Extensions → Apps Script), not on
 * the website. It's kept here as a backup. See README.md, "RSVP backend".
 *
 * Tabs in the Sheet:
 *   Guests      Your guest list, one row per person. You fill in:
 *                 Household    the same text for everyone in a party (e.g. "Smith family")
 *                 Name         first and last name, as guests will type it
 *                 Plus-one     "yes" for an unnamed guest (Name can be "Guest")
 *                 Other names  optional nicknames, comma separated (e.g. "Bob, Bobby Smith")
 *               The script adds "rsvp:..." columns holding each person's answers.
 *   Households  Made by the script: answers asked once per party (note, song requests).
 *   Log         Made by the script: a copy of every RSVP sent, newest at the bottom.
 *
 * Guests only ever see, and the script only ever changes, the "rsvp:" columns,
 * so you can add your own columns (addresses, notes to yourselves) safely.
 */

const PREFIX = "rsvp:";

// A shared key your site sends with every request, so that bots which scan public
// GitHub repos for Apps Script URLs can't query or write to your guest list just by
// finding this URL. It does NOT stop someone who actually reads your website's code
// (same as the password screen) — it only keeps out automated/casual visitors who
// never look past the URL itself. Set this to anything long and random, then put the
// exact same value in js/rsvp.js. See README.md, "RSVP backend".
const SITE_KEY = "5679b9f87e1481b7dc72ba7eaefdd567b5746186b7433880";

function doGet(e) {
  return respond(() => {
    // Wrong/missing key looks exactly like "no such guest" — never reveals that a key is expected
    if (e.parameter.key !== SITE_KEY) return { status: "notfound" };
    if (e.parameter.action === "lookup") return lookup(e.parameter.name || "");
    throw new Error("Unknown action");
  });
}

function doPost(e) {
  return respond(() => {
    const body = JSON.parse(e.postData.contents);
    // Wrong/missing key fails the same way a stale invitation would
    if (body.key !== SITE_KEY) throw new Error("Your invitation has changed. Please look up your name again.");
    if (body.action === "submit") return submit(body);
    throw new Error("Unknown action");
  });
}

function respond(fn) {
  let result;
  try {
    result = fn();
  } catch (err) {
    console.error(err);
    result = { status: "error", message: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Looking up a party ----------

function lookup(name) {
  const target = normalize(name);
  const { guests } = readGuests();
  const match = target && guests.find((g) => !g.plusOne && g.names.includes(target));
  if (!match) return { status: "notfound" };

  const party = guests.filter((g) => g.householdId === match.householdId);
  return {
    status: "found",
    household: {
      id: match.householdId,
      responses: readHousehold(match.householdId).responses,
      members: party.map((g) => ({
        id: g.id,
        name: g.name,
        plusOne: g.plusOne,
        responses: g.responses,
      })),
    },
  };
}

// ---------- Saving an RSVP ----------

function submit(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one RSVP at a time, so two people can't overwrite each other
  try {
    const { tab, guests } = readGuests();
    const party = guests.filter((g) => g.householdId === body.householdId);
    const byId = {};
    party.forEach((g) => { byId[g.id] = g; });
    const members = body.members || [];
    if (!party.length || !members.length || members.some((m) => !byId[m.id])) {
      throw new Error("Your invitation has changed. Please look up your name again.");
    }

    const now = new Date();

    // Each person's answers, on their row in Guests
    const keys = questionKeys(body.questions);
    const cols = ensureColumns(tab, keys.concat("updated"));
    members.forEach((m) => {
      const row = byId[m.id].row;
      keys.forEach((k) => writeText(tab.sheet.getRange(row, cols[k]), (m.responses || {})[k]));
      tab.sheet.getRange(row, cols.updated).setValue(now);
    });

    // Party-wide answers, on the party's row in Households
    const hKeys = questionKeys(body.householdQuestions);
    const house = readHousehold(body.householdId);
    let row = house.row;
    if (!row) {
      house.tab.sheet.appendRow([party[0].household]);
      row = house.tab.sheet.getLastRow();
    }
    const hCols = ensureColumns(house.tab, hKeys.concat("updated"));
    hKeys.forEach((k) => writeText(house.tab.sheet.getRange(row, hCols[k]), (body.household || {})[k]));
    house.tab.sheet.getRange(row, hCols.updated).setValue(now);

    // A copy of everything, in case anything ever needs untangling
    const log = getSheet("Log", ["Time", "Household", "Answers"]);
    log.appendRow([now, party[0].household, JSON.stringify({
      people: members.map((m) => Object.assign({ name: byId[m.id].name }, m.responses)),
      party: body.household || {},
    })]);

    return { status: "ok" };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Reading the Sheet ----------

function readGuests() {
  const tab = readTab(getSheet("Guests"));
  const c = {
    household: tab.col("Household"),
    name: tab.col("Name"),
    plusOne: tab.col("Plus-one"),
    other: tab.col("Other names"),
  };
  if (c.name < 0) throw new Error('The Guests tab needs a "Name" column.');

  const seen = {};
  const guests = [];
  tab.rows.forEach((row, i) => {
    const name = String(row[c.name]).trim();
    if (!name) return;
    // People with no Household are a party of one
    const household = (c.household >= 0 && String(row[c.household]).trim()) || name;
    const householdId = normalize(household);
    // id is only used between looking someone up and saving, so it can be simple
    const key = householdId + "|" + normalize(name);
    seen[key] = (seen[key] || 0) + 1;
    const others = c.other >= 0 ? String(row[c.other]).split(/[,;]/) : [];
    guests.push({
      row: i + 2,
      id: key + "|" + seen[key],
      household,
      householdId,
      name,
      plusOne: c.plusOne >= 0 && /^(y|yes|x|true|1|✓|✔)$/i.test(String(row[c.plusOne]).trim()),
      names: [name].concat(others).map(normalize).filter(Boolean),
      responses: rsvpColumns(tab.headers, row),
    });
  });
  return { tab, guests };
}

function readHousehold(householdId) {
  const tab = readTab(getSheet("Households", ["Household"]));
  const c = tab.col("Household");
  const i = tab.rows.findIndex((r) => normalize(r[c]) === householdId);
  return {
    tab,
    row: i >= 0 ? i + 2 : null,
    responses: i >= 0 ? rsvpColumns(tab.headers, tab.rows[i]) : {},
  };
}

// Finds a tab by name, creating it with the given header row if it's missing
function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet && headers) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  if (!sheet) throw new Error('Couldn\'t find a tab named "' + name + '".');
  return sheet;
}

function readTab(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((h) => String(h).trim());
  return {
    sheet,
    headers,
    rows: values.slice(1),
    col: (h) => headers.findIndex((x) => x.toLowerCase() === h.toLowerCase()),
  };
}

// { stay: "...", email: "..." } from a row's "rsvp:" columns
function rsvpColumns(headers, row) {
  const out = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase();
    if (lower.startsWith(PREFIX) && lower !== PREFIX + "updated") {
      out[h.slice(PREFIX.length).trim()] = row[i] instanceof Date ? row[i].toISOString() : String(row[i]);
    }
  });
  return out;
}

// Adds any missing "rsvp:" columns; returns { key: column number }
function ensureColumns(tab, keys) {
  const cols = {};
  keys.forEach((k) => {
    let i = tab.col(PREFIX + k);
    if (i < 0) {
      tab.headers.push(PREFIX + k);
      i = tab.headers.length - 1;
      tab.sheet.getRange(1, i + 1).setValue(PREFIX + k);
    }
    cols[k] = i + 1;
  });
  return cols;
}

// Saves as plain text, so phone numbers aren't turned into numbers/dates
// and nothing a guest types can become a formula
function writeText(range, value) {
  range.setNumberFormat("@").setValue(value == null ? "" : String(value).slice(0, 2000));
}

function questionKeys(list) {
  return (Array.isArray(list) ? list : [])
    .map(String)
    .filter((k) => /^[A-Za-z0-9_-]{1,40}$/.test(k) && k !== "updated")
    .slice(0, 50);
}

// "  José  O'Brien-Smith " -> "jose obrien smith" (matches js/rsvp.js)
function normalize(name) {
  return String(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[-–]/g, " ").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

// Run this from the Apps Script editor (select it, then ▶ Run) to check a name
function testLookup() {
  console.log(JSON.stringify(lookup("Jane Example"), null, 2));
}
