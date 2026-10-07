# Wedding website

A plain HTML/CSS site hosted on GitHub Pages. There's no build step: edit the `.html` files and push.

## Files

| File | Page |
|---|---|
| `index.html` | Home |
| `schedule.html` | Schedule |
| `travel.html` | Travel & Lodging |
| `things-to-do.html` | Things to Do |
| `faq.html` | FAQ |
| `rsvp.html` | RSVP form |
| `css/style.css` | All styling (colors are at the top) |
| `js/rsvp.js` | Sends the RSVP form to Google Forms |
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

## Connecting the RSVP form

The RSVP page shows a form styled like the rest of the site. When a guest submits it,
the answers are sent to a Google Form, which saves them to a Google Sheet.

1. **Create the Google Form** at forms.google.com with these questions, in any order:
   - Your name(s): Short answer
   - Email: Short answer
   - Will you be joining us?: Multiple choice with exactly two options, `Joyfully accepts` and `Regretfully declines`
   - Number of guests attending: Short answer
   - Dietary restrictions or allergies: Short answer
   - A note for us: Paragraph

   Don't mark any question "Required" in Google Forms (the website handles that).
   In Settings → Responses, turn **off** "Collect email addresses" and "Limit to 1 response".
   In the Responses tab, click "Link to Sheets" to send answers to a spreadsheet.

2. **Get the field IDs.** In the form editor, click the ⋮ menu → **Get pre-filled link**.
   Type something into every field (e.g. `aaa`, pick "Joyfully accepts"), then click **Get link** and copy it.
   The link looks like:

   ```
   https://docs.google.com/forms/d/e/1FAIpQLSc...xyz/viewform?usp=pp_url&entry.123456789=aaa&entry.987654321=Joyfully+accepts...
   ```

   - The long part after `/forms/d/e/` and before `/viewform` is your **form ID**.
   - Each `entry.NNNNNNN` is the ID of one question, in the order you filled them in.

3. **Paste them in:**
   - In `js/rsvp.js`, replace `PASTE_YOUR_FORM_ID_HERE` with the form ID.
   - In `rsvp.html`, replace each placeholder `entry.1111111111`, `entry.2222222222`, etc. with the matching real ID.

4. **Test it** by submitting the form on the live site. Check that a row shows up in the Google Sheet.

To add a question (e.g. meal choice), add it to the Google Form, then copy one of the
`<div class="field">` blocks in `rsvp.html` and use the new `entry.` ID.
For multiple-choice questions, the website's `value="..."` text must exactly match the option text in the Google Form.

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
