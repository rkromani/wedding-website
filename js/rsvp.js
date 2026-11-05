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
    email: "",
    note: "",
    members: [
      { id: "demo-1a", name: "Jane Example", responses: {} },
      { id: "demo-1b", name: "John Example", responses: {} },
    ],
  },
  {
    id: "demo-2",
    email: "",
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
const template = document.getElementById("person-template");

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

// ---------- Step 2: one set of questions per person ----------

function showHousehold(data) {
  household = data;
  partyList.innerHTML = "";

  household.members.forEach((member, i) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.memberId = member.id;
    card.querySelector(".person-name").textContent = member.plusOne ? "Your guest" : member.name;

    // Give every input a unique name per person (e.g. "p0-friday"),
    // remembering the original question name in data-key.
    card.querySelectorAll("input, select, textarea").forEach((input) => {
      input.dataset.key = input.name;
      input.name = `p${i}-${input.name}`;
    });

    // Wire up labels for the guest-name box
    const guestName = card.querySelector(".guest-name");
    const guestInput = guestName.querySelector("input");
    guestInput.id = `p${i}-guest-name`;
    guestName.querySelector("label").htmlFor = guestInput.id;
    guestInput.disabled = !member.plusOne;
    if (member.plusOne) {
      guestName.hidden = false;
      if (member.name && member.name !== "Guest") guestInput.value = member.name;
    }

    // Pre-fill anything they answered before
    const saved = member.responses || {};
    card.querySelectorAll("[data-key]").forEach((input) => {
      const value = saved[input.dataset.key];
      if (value == null || value === "") return;
      if (input.type === "radio") input.checked = input.value === value;
      else input.value = value;
    });

    // Only ask the follow-up questions if this person is coming
    const details = card.querySelector(".person-details");
    const update = () => {
      const coming = card.querySelector('[data-key="attending"]:checked')?.value === "Joyfully accepts";
      details.hidden = !coming;
      details.disabled = !coming; // disabled = not required
      guestInput.required = member.plusOne && coming;
    };
    card.querySelectorAll('[data-key="attending"]').forEach((r) => r.addEventListener("change", update));
    update();

    partyList.append(card);
  });

  const names = household.members.filter((m) => !m.plusOne).map((m) => m.name);
  if (household.members.some((m) => m.plusOne)) names.push("a guest");
  partyNames.textContent = joinNames(names);

  document.getElementById("rsvp-email").value = household.email || "";
  document.getElementById("rsvp-note").value = household.note || "";

  lookupForm.hidden = true;
  rsvpForm.hidden = false;
  showError(rsvpError, "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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

  const members = [...partyList.querySelectorAll(".person")].map((card) => {
    const responses = {};
    // Skip questions hidden because the person declined
    card.querySelectorAll("[data-key]:not(:disabled)").forEach((input) => {
      if (input.type === "radio") {
        if (input.checked) responses[input.dataset.key] = input.value;
      } else {
        responses[input.dataset.key] = input.value.trim();
      }
    });
    return { id: card.dataset.memberId, responses };
  });

  const button = rsvpForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending…";

  try {
    const result = await saveResponses({
      householdId: household.id,
      email: document.getElementById("rsvp-email").value.trim(),
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
