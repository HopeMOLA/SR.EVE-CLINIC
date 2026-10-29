# Sr. Eve’s Clinic: plain HTML website

Pure HTML, CSS and JavaScript. No framework, no build step, no npm, no third-party requests
(fonts are self-hosted, icons are inlined). Open `index.html` or serve the folder with any static host.

```
index.html                 Home (hero, services, about, hours, team, CTA, contact)
services.html              Full services list (+ items awaiting clinic confirmation)
patient-information.html   Preparing for visits, payment, privacy, FAQ
privacy.html / terms.html  DRAFT templates, need clinic / legal review
css/styles.css             All styling (colour tokens at the top)
js/config.js               ★ Clinic details, assets and backend endpoints
js/main.js                 Navigation, modal, forms, validation, scroll effects
js/icons.js                Inline SVG icon sprite
assets/                    fonts, favicon, brand/ (logo) and images/ (photos)
```

## What still needs to come from the clinic

Nothing is invented. Unknown details show clearly marked "to be confirmed" states.

| Item | Where |
| --- | --- |
| Logo (original file, unmodified) | put in `assets/brand/`, set `assets.logo` in `js/config.js` |
| Hero + reception photos | put in `assets/images/`, set `assets.hero` / `assets.about` |
| Phone, WhatsApp (digits, international), email, address, map URLs | `contact` in `js/config.js` |
| Payment / medical aid wording | `paymentInfo` in `js/config.js` |
| Team members | replace the placeholder `<li>` cards in `index.html` (`#team`) |
| Service confirmations (sonar, aesthetic treatments, other screenings) | "Awaiting clinic confirmation" block in `services.html` |
| Privacy policy + terms | `privacy.html`, `terms.html` (marked drafts) |

Opening hours (supplied) appear in `js/config.js`, plus plain text in `index.html`, `patient-information.html`
and the footer. Change them in all places if they ever change.

Brand colours were approximated from the reference image; adjust the variables at the top of `css/styles.css`
if the logo uses different values. Add a real favicon by replacing `assets/favicon.svg` (the current one is a
generic stand-in, not the clinic logo).

## Appointment requests: how they work

The form never pretends to have booked anything.

* **No endpoint set** (default): the form validates, then states that nothing was sent and offers the clinic's
  direct contact options (only those that have been configured).
* **`integrations.bookingEndpoint` set**: the request is POSTed as JSON over HTTPS. A `2xx` reply shows
  "Request received. Not confirmed until the clinic contacts you."
* **`integrations.availabilityEndpoint` set**: the time dropdown shows **only** slots your scheduling system
  returns. Without it, times are opening-hours windows labelled as preferences.

`POST bookingEndpoint`

```json
{ "name": "…", "phone": "…", "email": "…", "serviceId": "antenatal-care", "serviceTitle": "Antenatal Care",
  "date": "2026-11-05", "time": "09:30", "message": "…", "consentToPrivacyNotice": true,
  "website": "", "elapsedMs": 21345 }
```

`POST availabilityEndpoint` with `{ "date": "2026-11-05", "serviceId": "…" }` → `{ "slots": ["08:30", "09:00"] }`

`POST contactEndpoint` with `{ name, email, phone, message, consentToPrivacyNotice, website, elapsedMs }`

The backend must (this cannot be done safely in the browser): re-validate every field, reject unknown fields,
reject a non-empty `website` (honeypot) or implausibly small `elapsedMs`, rate-limit and optionally add a CAPTCHA,
restrict CORS to this site's origin, keep all secrets server-side, store/email data securely, and never log bodies.

Patient data is sent only in POST bodies, never in URLs, and is never logged or sent to analytics.

## Accessibility and motion

Semantic landmarks, skip link, labelled fields with inline errors, a focus-trapped request dialog that restores
focus on close, visible focus rings, native `<details>` FAQ, and `prefers-reduced-motion` support (reveal, float and
hover movement are switched off). Re-check with a screen reader and contrast tools once the final logo, photos and
copy are in.
