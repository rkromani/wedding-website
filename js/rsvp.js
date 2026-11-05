// RSVP: look up a household by name, then answer for each person in it.
//
// Answers are stored in a Google Sheet through a small Google Apps Script
// "web app". Paste its URL here once it's set up (it ends in /exec).
// Until then, the page runs in DEMO MODE using the sample guests below,
// and nothing is saved.
const RSVP_API_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

// Sample guests for demo mode only. Try "Jane Example" or "Sam Sample".
const DEMO_HOUSEHOLDS = [
  {
    id: "demo-1",
    note: "",
    members: [
      { id: "demo-1a", name: "Jane Example", responses: {} },
      { id: "demo-1b", name: "John Example", responses: {} },
      { id: "demo-1c", name: "Emma Example", responses: {} },
      { id: "demo-1d", name: "Oliver Example", responses: {} },
      { id: "demo-1e", name: "Lucy Example", responses: {} },
    ],
  },
  {
    id: "demo-2",
    note: "",
    members: [
      { id: "demo-2a", name: "Sam Sample", responses: {} },
      { id: "demo-2b", name: "Guest", plusOne: true, responses: {} },
    ],
  },
];

const DEMO_MODE = RSVP_API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

const lookupForm = document.getElementById("lookup-form");
const lookupError = document.getElementById("lookup-error");
const rsvpForm = document.getElementById("rsvp-form");
const rsvpError = document.getElementById("rsvp-error");
const partyList = document.getElementById("party-list");
const partyNames = document.getElementById("party-names");
const thanks = document.getElementById("rsvp-thanks");
const template = document.getElementById("questions-template");

let household = null;

if (DEMO_MODE) {
  const banner = document.createElement("p");
  banner.className = "demo-banner";
  banner.textContent = "Demo mode: responses are not saved. Try the name “Jane Example” or “Sam Sample”.";
  lookupForm.before(banner);
}

// "  Jane  O'Example " -> "jane oexample"
function normalize(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function showError(box, message) {
  box.textContent = message;
  box.hidden = !message;
}

// ---------- Talking to the Google Sheet ----------

async function lookupHousehold(name) {
  if (DEMO_MODE) {
    const target = normalize(name);
    const match = DEMO_HOUSEHOLDS.find((h) =>
      h.members.some((m) => !m.plusOne && normalize(m.name) === target)
    );
    return match ? { status: "found", household: structuredClone(match) } : { status: "notfound" };
  }
  const response = await fetch(`${RSVP_API_URL}?action=lookup&name=${encodeURIComponent(name)}`);
  return response.json();
}

async function saveResponses(payload) {
  if (DEMO_MODE) {
    console.log("Demo mode, would have saved:", payload);
    return { status: "ok" };
  }
  // text/plain avoids a CORS "preflight" request, which Apps Script doesn't support
  const response = await fetch(RSVP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "submit", ...payload }),
  });
  return response.json();
}

// ---------- Step 1: find the invitation ----------

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(lookupError, "");
  const button = lookupForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Looking…";

  try {
    const result = await lookupHousehold(document.getElementById("lookup-name").value);
    if (result.status === "found") {
      showHousehold(result.household);
    } else {
      showError(lookupError,
        "We couldn't find that name. Please enter your first and last name as they appear on your invitation. " +
        "If it still doesn't work, reach out to us and we'll sort it out.");
    }
  } catch (err) {
    showError(lookupError, "Something went wrong. Please try again in a moment.");
  } finally {
    button.disabled = false;
    button.textContent = "Find my invitation";
  }
});

// ---------- Step 2: a grid with one column per person ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function showHousehold(data) {
  household = data;
  partyList.innerHTML = "";

  const members = household.members;
  const grid = el("div", "rsvp-grid");
  grid.style.setProperty("--people", members.length);

  // Header row: each person's name (or a name box for a plus-one)
  members.forEach((member, i) => {
    const head = el("div", "grid-name");
    head.dataset.person = i;
    if (member.plusOne) {
      head.append(el("span", "", "Your guest"));
      const input = el("input");
      input.type = "text";
      input.name = `p${i}-guestName`;
      input.dataset.key = "guestName";
      input.dataset.person = i;
      input.placeholder = "Guest's name";
      input.setAttribute("aria-label", "Your guest's name");
      if (member.name && member.name !== "Guest") input.value = member.name;
      head.append(input);
    } else {
      head.textContent = member.name;
    }
    grid.append(head);
  });

  // One row per question, one cell per person
  let pastAttending = false;
  template.content.querySelectorAll(".field").forEach((question) => {
    const prompt = question.querySelector("legend, label:not(.choice)");
    const key = question.querySelector("input, select, textarea").name;
    const followUp = pastAttending; // questions after "attending" are only asked of people who accept
    if (key === "attending") pastAttending = true;

    grid.append(el("div", "grid-question", prompt.textContent));

    members.forEach((member, i) => {
      const cell = el("fieldset", "grid-cell");
      cell.dataset.person = i;
      if (followUp) cell.classList.add("follow-up");
      const personName = member.plusOne ? "Your guest" : member.name;
      cell.append(el("legend", "visually-hidden", `${personName}: ${prompt.textContent}`));

      const answers = question.cloneNode(true);
      answers.querySelector("legend, label:not(.choice)").remove();
      answers.querySelectorAll("input, select, textarea").forEach((input) => {
        input.dataset.key = input.name;
        input.dataset.person = i;
        input.name = `p${i}-${input.name}`;
        if (input.type !== "radio") input.setAttribute("aria-label", cell.firstChild.textContent);
      });
      cell.append(...answers.childNodes);
      if (followUp) cell.append(el("span", "not-attending", "—"));
      grid.append(cell);
    });
  });

  // Pre-fill anything they answered before
  grid.querySelectorAll("[data-key]").forEach((input) => {
    const value = (members[input.dataset.person].responses || {})[input.dataset.key];
    if (value == null || value === "") return;
    if (input.type === "radio") input.checked = input.value === value;
    else input.value = value;
  });

  // Only ask the follow-up questions of people who are coming
  members.forEach((member, i) => {
    const update = () => {
      const coming = grid.querySelector(`[data-person="${i}"][data-key="attending"]:checked`)?.value === "Joyfully accepts";
      grid.querySelectorAll(`.follow-up[data-person="${i}"]`).forEach((cell) => {
        cell.disabled = !coming; // disabled = not required
      });
      const guestInput = grid.querySelector(`.grid-name [data-person="${i}"]`);
      if (guestInput) guestInput.required = coming;
    };
    grid.querySelectorAll(`[data-person="${i}"][data-key="attending"]`).forEach((r) => r.addEventListener("change", update));
    update();
  });

  const wrap = el("div", "rsvp-grid-wrap");
  wrap.append(grid);
  partyList.append(el("p", "scroll-hint", "Scroll sideways to see everyone →"));
  partyList.append(wrap);
  rsvpForm.classList.toggle("is-wide", members.length >= 4); // more room for big parties

  const names = members.filter((m) => !m.plusOne).map((m) => m.name);
  if (members.some((m) => m.plusOne)) names.push("a guest");
  partyNames.textContent = joinNames(names);

  document.getElementById("rsvp-note").value = household.note || "";

  lookupForm.hidden = true;
  rsvpForm.hidden = false;
  updateScrollHint();
  showError(rsvpError, "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Show the "scroll sideways" hint only when the grid doesn't fit (e.g. on phones)
function updateScrollHint() {
  const wrap = partyList.querySelector(".rsvp-grid-wrap");
  const hint = partyList.querySelector(".scroll-hint");
  if (wrap && hint) hint.hidden = wrap.scrollWidth <= wrap.clientWidth + 1;
}
window.addEventListener("resize", updateScrollHint);

// ["A", "B", "C"] -> "A, B and C"
function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

document.getElementById("search-again").addEventListener("click", (event) => {
  event.preventDefault();
  household = null;
  rsvpForm.hidden = true;
  lookupForm.hidden = false;
  document.getElementById("lookup-name").select();
});

rsvpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(rsvpError, "");

  const members = household.members.map((member, i) => {
    const responses = {};
    // Skip questions turned off because the person declined
    partyList.querySelectorAll(`[data-person="${i}"][data-key]:not(:disabled)`).forEach((input) => {
      if (input.type === "radio") {
        if (input.checked) responses[input.dataset.key] = input.value;
      } else {
        responses[input.dataset.key] = input.value.trim();
      }
    });
    return { id: member.id, responses };
  });

  const button = rsvpForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending…";

  try {
    const result = await saveResponses({
      householdId: household.id,
      note: document.getElementById("rsvp-note").value.trim(),
      members,
    });
    if (result.status !== "ok") throw new Error(result.message || "Save failed");
    rsvpForm.hidden = true;
    thanks.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showError(rsvpError, "Something went wrong saving your RSVP. Please try again, or email us your RSVP.");
  } finally {
    button.disabled = false;
    button.textContent = "Send RSVP";
  }
});
