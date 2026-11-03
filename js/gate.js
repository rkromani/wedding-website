// Simple password screen.
// This keeps casual visitors out. It is NOT real security: anyone who knows
// how to read page code can get around it.
//
// To change the password, ask Claude, or run this in Terminal and paste the result below:
//   printf '%s' 'newpassword' | shasum -a 256
// (Use lowercase. Guests' typing is lowercased and trimmed before checking.)
const PASSWORD_HASH = "20c423d8ea71c26098f7c7c5fdb4acb95acca9d3b69915e9bc151de337f4a641";

(function () {
  const KEY = "wedding-unlocked";

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === PASSWORD_HASH) return;

  document.documentElement.classList.add("locked");

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const title = document.querySelector(".site-title");
    const gate = document.createElement("div");
    gate.className = "gate";
    gate.innerHTML = `
      <form class="gate-form">
        <p class="gate-title">${title ? title.innerHTML : ""}</p>
        <div class="divider"><span></span></div>
        <label for="gate-password">Please enter the password from your invitation</label>
        <input type="password" id="gate-password" autocomplete="current-password" autofocus>
        <button class="button" type="submit">Enter</button>
        <p class="form-error" hidden>That's not quite right. Please try again.</p>
      </form>`;
    document.body.appendChild(gate);

    const form = gate.querySelector("form");
    const input = gate.querySelector("input");
    const error = gate.querySelector(".form-error");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const hash = await sha256(input.value.trim().toLowerCase());
      if (hash === PASSWORD_HASH) {
        try { localStorage.setItem(KEY, hash); } catch (e) {}
        document.documentElement.classList.remove("locked");
        gate.remove();
      } else {
        error.hidden = false;
        input.select();
      }
    });
  });
})();
