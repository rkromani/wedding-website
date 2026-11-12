# Wedding website

A plain HTML/CSS site hosted on GitHub Pages. There's no build step: edit the `.html` files and push.

## Files

| File | Page |
|---|---|
| `index.html` | Home |
| `schedule.html` | Schedule |
| `travel.html` | Travel |
| `lodging.html` | Lodging |
| `things-to-do.html` | Things to Do |
| `faq.html` | FAQ |
| `rsvp.html` | RSVP form |
| `css/style.css` | All styling (colors are at the top) |
| `what-to-expect.html` | What to Expect |
| `js/rsvp.js` | RSVP page: name lookup and saving answers |
| `apps-script/Code.gs` | RSVP backend (runs in the Google Sheet, not on the site) |
| `images/` | Put your photos here |

The names, date, and email address appear on **every page** (header and footer).
Use find-and-replace across all files for `Partner One`, `Partner Two` and `you@example.com`.

To add or rename a page, update the `<nav>` block at the top of every page.

## Adding photos

1. Put the photo in `images/`. Resize large phone photos to about 2000px wide first.
   On a Mac: open the photo in Preview, then Tools → Adjust Size.
2. Find the placeholder in the HTML. It looks like this:

   ```html
   <!-- PHOTO: delete the placeholder div and un-comment the img line below -->
   <!-- <img class="ratio-wide" src="images/hero.jpg" alt="Hero photo"> -->
   <div class="photo-placeholder ratio-wide">Hero photo</div>
   ```

3. Delete the `<div class="photo-placeholder ...">` line. Remove the `<!--` and `-->` around the `<img>` line.
   Change `src` to your file name and `alt` to a short description:

   ```html
   <img class="ratio-wide" src="images/us-at-rainier.jpg" alt="The two of us at Mount Rainier">
   ```

The `class` sets the shape. Photos are cropped to fit it:
`ratio-square` (1:1), `ratio-wide` (3:2), `ratio-banner` (16:7).
File names are case-sensitive on GitHub: `Photo.JPG` and `photo.jpg` are different files.

## RSVP backend (Google Sheet)

Guests type their name, the page looks up everyone in their party, and the answers are
saved to a Google Sheet. The Sheet runs a small script (`apps-script/Code.gs`) that the
website talks to. Until it's connected, the RSVP page runs in **demo mode** (try "Jane Example").

### 1. Make the Sheet

Create a new Google Sheet. Rename the first tab (bottom left) to **Guests**, and put these
headers in row 1:

| Household | Name | Plus-one | Other names |
|---|---|---|---|
| Smith family | Jane Smith | | Janie |
| Smith family | John Smith | | |
| Lee | Sam Lee | | |
| Lee | Guest | yes | |
| | Alex Doe | | |

- **Household**: the same text for everyone in a party. Blank means a party of one.
- **Name**: first and last name, the way guests will type it. Capitals, accents and punctuation don't matter.
- **Plus-one**: `yes` for an unnamed guest. Guests can't look themselves up by this row; they're
  shown as "Your guest" with a box to fill in their name.
- **Other names** (optional): nicknames or alternate spellings, separated by commas.

You can add your own columns (addresses, notes to yourselves) anywhere. Guests never see them.

### 2. Add the script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete what's in the editor, paste in all of `apps-script/Code.gs`, and click 💾 Save.
3. Find the `SITE_KEY` line near the top and set it to a long random string (anything works —
   mash the keyboard, or ask Claude to generate one). This keeps bots that scan public GitHub
   repos for Apps Script URLs from being able to use yours; see "Why SITE_KEY exists" below.
4. Click **Deploy → New deployment**. Click the ⚙️ next to "Select type" → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, then **Authorize access** and pick your Google account. Google will warn that
   the app isn't verified (it's your own script): click **Advanced → Go to … (unsafe)** → **Allow**.
6. Copy the **Web app URL** (ends in `/exec`).

### 3. Connect the website

In `js/rsvp.js`, replace `PASTE_YOUR_APPS_SCRIPT_URL_HERE` with that URL, and set `SITE_KEY` to
the **exact same string** you put in `Code.gs`. You can also delete the `DEMO_HOUSEHOLDS` sample
guests. Then test by RSVPing as yourself on the site and checking the Sheet.

#### Why `SITE_KEY` exists

The Apps Script URL isn't a secret on its own — your site has to send it to every visitor's
browser to work, the same way the password screen only keeps out casual visitors (see its
comment in `js/gate.js`). `SITE_KEY` doesn't change that; what it stops is a different, more
automated problem: tools that continuously scan public GitHub for exposed API-looking URLs and
try to abuse whatever they find. Without the key, one of those could call the Sheet directly —
most usefully to look up any guest by name and read their email/phone/notes, since that only
requires knowing a name. With the key, a request that doesn't include the exact right string is
treated as if it were just a wrong name or a stale invitation, so a scanner can't even tell the
key check exists. It won't stop someone who actually reads your site's code (nothing short of a
real login would), but that's a much smaller, much less likely risk than automated scanning.

### Where answers go

- **Guests tab**: the script adds an `rsvp:` column for each question (`rsvp:email`, `rsvp:stay`, ...)
  plus `rsvp:updated`. Columns appear the first time someone answers.
- **Households tab** (created automatically): questions asked once per party (song requests, the note).
- **Log tab** (created automatically): a copy of every RSVP sent, so nothing is lost if someone changes their answers.

Don't rename the `rsvp:` columns. Feel free to move them, filter, sort, or add a summary tab.

### Changing questions

Edit the questions in `rsvp.html` (see the comments there). Each question's `name="..."`
becomes its column name, so a new question just shows up as a new `rsvp:` column.
If you change an answer's wording, people who already picked the old wording won't see it pre-selected.

### If you change the script

After editing the code in Apps Script, go to **Deploy → Manage deployments**, click ✏️,
set Version to **New version**, and **Deploy**. The URL stays the same.

If you ever want to rotate `SITE_KEY` (e.g. you suspect it leaked somewhere), change it in both
`Code.gs` and `js/rsvp.js` to the same new value, redeploy as above, and push the site. Until both
sides match, the site's requests will fail the same way a stale invitation does.

## Publishing (GitHub Pages)

After the first-time setup, publishing changes is:

```
git add -A
git commit -m "Update site"
git push
```

The site updates about a minute after you push.

## Privacy notes

- Every page has a `noindex` tag, so search engines shouldn't list the site. Anyone with the link can still view it.
- The repository is public by default, so the files are visible on GitHub too.
  Don't put anything in the site you wouldn't want a stranger to see, such as a home address or guest list.
