// RSVP form -> Google Form
//
// Paste your Google Form's ID here. It's the long string in the form's URL:
//   https://docs.google.com/forms/d/e/THIS_PART/viewform
// See README.md, "Connecting the RSVP form", for full steps.
const GOOGLE_FORM_ID = "PASTE_YOUR_FORM_ID_HERE";

const form = document.getElementById("rsvp-form");
const thanks = document.getElementById("rsvp-thanks");
const errorBox = document.getElementById("rsvp-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  if (GOOGLE_FORM_ID === "PASTE_YOUR_FORM_ID_HERE") {
    errorBox.textContent = "The RSVP form isn't connected yet. See README.md.";
    errorBox.hidden = false;
    return;
  }

  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Sending…";

  try {
    // Google doesn't send a readable reply to other sites ("no-cors"),
    // so we can't confirm success. If the request goes out, we assume it worked.
    await fetch(`https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`, {
      method: "POST",
      mode: "no-cors",
      body: new FormData(form),
    });
    form.hidden = true;
    thanks.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    errorBox.textContent = "Something went wrong. Please try again, or email us your RSVP.";
    errorBox.hidden = false;
    button.disabled = false;
    button.textContent = "Send RSVP";
  }
});
