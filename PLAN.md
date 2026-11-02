# aTerem — Booking & Payment Platform (rework)

**Status:** Draft plan (open decisions marked `[?]`)
**Audience:** implementer (human or agent)

---

## 0. Current state (existing site: www.a-terem.hu)

Existing site surveyed (public HTML only):

- **Brand:** aTerem — training place, **Székesfehérvár, Hungary**. Accent color
  `#F96D00` (orange). Logo assets exist (`/images/cropped-logo-*.png`,
  `/images/aTerem.png`).
- **Stack today:** static-ish custom site — Bootstrap 4 + jQuery, forms POST via
  AJAX back to the same URL (custom backend, **not** WordPress — `wp-login.php` 404s).
- **Existing features:**
  - Registration (email, password, lastname, firstname, phone, GDPR consent checkbox).
  - Login (email + password + "remember me") and forgot-password page.
  - `/adatkezelesi-tajekoztato/` GDPR privacy policy already exists.
  - Contact: `info@a-terem.hu`, +36 30 643 4361; Facebook + Instagram links.
- **Not present today:** no schedule/calendar, no booking, no payment.

**Implication for the rework:** keep brand + auth concept + GDPR, but rebuild on the
new Rust/Postgres stack. **Existing user accounts must be migrated** (email, name,
phone) — need access to the current backend DB.

---

## 1. Summary

A web page for a training place (gym / studio) that:

1. Shows the lesson schedule in a **calendar view** (6 group class types).
2. Lets visitors **buy a daily ticket** or a **monthly pass**.
3. Takes **online card payments**.

Two user roles: **visitor/customer** and **admin** (studio staff).

---

## 2. Open Questions & Working Assumptions

These must be answered before/while building. Assumptions are my defaults — change them and the plan adjusts.

| # | Question | Working assumption |
|---|----------|--------------------|
| Q1 | What kind of training place? (yoga / CrossFit / martial arts / gym group classes / dance…) | ✅ Group classes, **6 types**: Gerinctorna, Has-far-comb, Köredzés, Köredzés+nyújtás, Nyújtás, Trambulin |
| Q2 | Single or multiple locations? | ✅ Single location |
| Q3 | Recurring weekly timetable, one-off events, or both? | ✅ Both: recurring weekly template + one-off/extra classes |
| Q4 | Does a class have a capacity limit? Waitlist? | Yes, capacity limit; no waitlist in v1 |
| Q5 | Is a "daily ticket" one class or all-day access? | One class (drop-in), but named per class type |
| Q6 | Monthly pass: calendar month or rolling 30 days? Unlimited or capped? | Rolling 30 days from purchase, unlimited classes |
| Q7 | Do customers book a specific class, or buy a pass and just show up? | Book a specific class slot; pass grants the booking |
| Q8 | Check-in mechanism? (QR code / name list / staff scan) | QR code shown to customer; staff scans |
| Q9 | Region + currency? | EUR |
| Q10 | Merchant account / business entity + tax ID available? | Yes (needed for Stripe) |
| Q11 | VAT on tickets? Receipts/invoices required? | VAT-inclusive price; email receipt only in v1 |
| Q12 | Refund & cancellation policy? | Auto-refund if class cancelled; no refund for no-show |
| Q13 | Monthly pass: recurring subscription or one-off repurchase each month? | Recurring subscription (Stripe Subscriptions) |
| Q14 | Customer accounts required, or guest checkout? | Account required (needed for pass management) |
| Q15 | GDPR / EU data protection applies? | Yes — consent, right-to-erasure, minimal data |
| Q16 | Who edits the schedule? Need admin UI? | Admin dashboard (staff edits classes/rooms) |
| Q17 | Notifications (email/SMS)? | Email confirmations + reminders (v1) |
| Q18 | Tech stack preference? | ✅ Vanilla HTML5/CSS/JS frontend + Rust (Axum) + PostgreSQL; FullCalendar for calendar |
| Q19 | Hosting preference? | ✅ Fresh cheap VPS; Postgres on same VPS; domain TBD (no domain yet) |
| Q20 | Budget & timeline? MVP scope? | ✅ No deadline; solo project; MVP-first confirmed |

---

## 3. Scope

### MVP (must have)
- Public calendar of classes (weekly recurring + one-off).
- Class detail: time, instructor, room, capacity, price.
- Auth (email + password, maybe OAuth).
- Book a class (reserve spot, capacity-aware).
- Buy daily ticket (one class) via Stripe Checkout.
- Buy monthly pass (recurring) via Stripe Subscriptions.
- Customer "my bookings" page + QR code for check-in.
- Admin: create/edit/delete classes, view bookings & revenue.
- Email receipt + booking confirmation.

### Later (v2+)
- Waitlists, multi-class packs, gift cards, promo codes.
- Check-in app / tablet mode for staff.
- SMS reminders, push notifications.
- Multi-location, instructor calendars.
- Cancellation policies with credits.
- Reports/analytics dashboard.

---

## 4. Architecture

```
Browser (vanilla HTML5 + CSS + JS, FullCalendar for the calendar view)
   │  HTTPS
   ▼
Rust web server (Axum)  ── serves static files + JSON API
   │
   ├── Auth (argon2 + sessions/JWT)
   ├── DB (PostgreSQL + SQLx)
   ├── Calendar UI (FullCalendar)  ← renders schedule from API
   └── Payments (Stripe via async-stripe)
          ├── Checkout (one-off: daily ticket)
          └── Subscriptions (recurring: monthly pass)
          └── Webhooks (confirm payment, activate pass, handle refunds)
```

Key principle: **Stripe is the source of truth for money.** Our DB only stores
customer/booking/pass state; payment success is confirmed via Stripe webhooks,
never via the client.

Key principle: **Postgres is the single source of truth for all app state**
(users, bookings, passes, orders). The app is **stateless** — no local files that
aren't recreated or backed up — so backing up Postgres backs up everything.

---

## 5. Tech Stack (decided)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Vanilla HTML5 + CSS + JS (no framework, no bundler or a trivial esbuild step) | Smallest payload, fastest load |
| Templates | **Askama** (Rust, compile-time type-safe) — see §5.1 | Fast render; redesign = edit templates + CSS |
| Calendar | FullCalendar (vanilla JS lib) | Recurring events, week/month views, date math |
| Backend | Rust + **Axum** | Fast, tokio-native, `tower-http` static serving |
| DB | PostgreSQL | Relational: bookings, passes, schedule |
| DB access | SQLx (async, compile-time-checked queries) | Type-safe, no ORM overhead |
| Payments | Stripe via **async-stripe** crate (Checkout + Subscriptions + webhooks) | Card payments, PCI handled by Stripe |
| Auth | argon2 (passwords) + server-side sessions (signed cookie) | Standard, fast, no client token storage |
| Email | **Resend** (free tier, 3k emails/mo) | Receipts + reminders |
| Deploy | Single static Rust binary behind Caddy/nginx for TLS | See §6 |

One binary serves both the static frontend and the API — no separate web
server needed, minimal moving parts.

### 5.1 Frontend templating & redesign-friendly structure

- **Server-rendered pages via Askama templates** (`templates/`) — decided.
  Askama compiles templates to Rust at build time: fastest render, type-checked.
- **Design tokens in CSS custom properties** (`static/css/tokens.css`): colors,
spacing, fonts, radii. A full redesign = swap token values + templates + CSS,
**without touching JS or API logic**.
- **Separation of concerns:** semantic HTML (templates) → presentation (CSS) →
behavior (JS). JS talks to the API via `fetch` and reads/writes the DOM through
`data-*` attributes/classes, never hardcoded text or colors, so markup can change
freely.
- **Recommended layout:**
  ```
  templates/          # Askama .html files (one per page)
  static/
    css/tokens.css    # design tokens (theming)
    css/site.css
    js/               # vanilla JS modules (api.js, calendar.js, checkout.js)
  ```

### 5.2 Performance & design principles

Speed is the top priority; design stays modern and clean. Rules to enforce:

- **No CSS frameworks, no JS frameworks.** Hand-rolled modern CSS: grid/flexbox,
  `clamp()`-based fluid type/spacing, CSS custom properties for theming.
- **System font stack or one self-hosted, subset web font** (no external font CDN
  blocking render). Prefer a variable font, `font-display: swap`.
- **Zero or minimal images**; inline SVG for icons; lazy-load anything heavier.
- **Progressive enhancement:** core pages work without JS; calendar/booking layer
  JS on top.
- **Performance budget (targets):** HTML < 50 KB, CSS < 30 KB, JS < 50 KB (pre-
  gzip), First Contentful Paint < 1s, time-to-interactive < 2s on a 4G phone.

---

## 6. Deployment

- **Decided:** single fresh VPS — Caddy (auto-TLS) reverse-proxying the Rust
  binary; PostgreSQL runs on the same VPS. Stripe webhooks need a public HTTPS URL.
- **Domain:** none yet — will be purchased. Caddy auto-HTTPS needs a real domain
  for TLS; use a placeholder domain in config until then (or temp self-signed/IP for dev).
- **Local dev:** Stripe test mode + Stripe CLI to forward webhooks to localhost.

### 6.1 Backup strategy (regular, automated)

Design rule: **Postgres is the only thing that needs backing up.** The app is
stateless, so if the VPS dies, a fresh deploy + a Postgres restore brings
everything back.

- **Nightly logical backup:** `pg_dump` to a timestamped, compressed file (e.g.
  `backups/db-YYYY-MM-DD.sql.gz`), run via cron/systemd-timer.
- **Offsite copy (required):** the dump is *not* enough on the same disk. Copy it
  to **Backblaze B2** (decided) via `rclone` or `restic`.
- **Retention:** keep e.g. 7 daily + 4 weekly, prune automatically.
- **Point-in-time recovery (optional, later):** enable WAL archiving with
  `wal-g`/`pgBackRest` if we ever need minute-level restore. Not needed for MVP.
- **Restore drill:** documented + tested — a backup that's never restored is a
  prayer, not a backup.

---

## 7. Data Model (draft)

```
User          id, email, passwordHash, firstname, lastname, phone,
              role(CUSTOMER|ADMIN), gdprConsentAt, createdAt
Instructor    id, name, bio
Room          id, name, capacity
ClassType     id, name, priceDropIn        (daily ticket price)
ScheduleEvent id, classTypeId, instructorId, roomId,
              rrule/frequency (recurring) OR one-off datetime,
              startTime, durationMin, capacity, active
Booking       id, userId, scheduleEventId (or occurrence id),
              status(BOOKED|CANCELLED|CHECKED_IN|NO_SHOW),
              passId (nullable), checkInCode/QR, createdAt
Pass          id, userId, type(DAILY|MONTHLY), status(ACTIVE|EXPIRED|CANCELLED),
              startsAt, expiresAt, stripeSubscriptionId
Order         id, userId, stripeSessionId/InvoiceId, amount, currency,
              status(PAID|REFUNDED), kind(TICKET|PASS), createdAt
```

Note on recurring events: either store an RRULE and expand to occurrences, or
materialize occurrences. Recommend **RRULE + on-the-fly expansion** (FullCalendar
supports RRULE via plugin) with materialized `Booking` rows per occurrence.

---

## 8. API (draft endpoints)

Public:
- `GET  /api/classes`              — schedule events in a date range (calendar feed)
- `GET  /api/classes/:id`          — class detail + remaining capacity

Customer (auth):
- `POST /api/bookings`             — book a class (validates capacity + pass/ticket)
- `GET  /api/me/bookings`          — my bookings
- `POST /api/checkout/ticket`      — create Stripe Checkout session (daily ticket)
- `POST /api/checkout/pass`        — create Stripe Checkout session (subscription)
- `GET  /api/me/pass`              — my active pass
- `POST /api/me/pass/cancel`       — cancel subscription

Admin (auth + role):
- `POST /api/admin/classes`        — create class
- `PUT  /api/admin/classes/:id`    — update class
- `DELETE /api/admin/classes/:id`  — delete/cancel class
- `GET  /api/admin/bookings`       — list bookings (by class/date)
- `GET  /api/admin/revenue`        — revenue summary

Webhooks:
- `POST /api/webhooks/stripe`      — payment success/fail, subscription events, refunds

---

## 9. Payment Flows

### Daily ticket (one-off)
1. Customer picks a class → clicks "Book".
2. Server creates Stripe Checkout session (mode=payment) for `priceDropIn`.
3. Customer pays on Stripe-hosted page.
4. Stripe webhook `checkout.session.completed` → server marks booking PAID/BOOKED,
   emits QR code, sends confirmation email.

### Monthly pass (recurring)
1. Customer clicks "Buy monthly pass".
2. Server creates Checkout session (mode=subscription) with monthly price.
3. Stripe webhooks: `customer.subscription.created` → activate pass (30 days);
   `invoice.paid` → extend pass; `customer.subscription.deleted` → expire pass.
4. Pass allows booking classes without per-class payment.

### Edge cases to handle
- Capacity race (two people booking last spot) → transaction / unique constraint.
- Class cancelled → refund via Stripe + notify booked customers.
- No-show → mark, no auto-refund (per Q12).
- Expired pass mid-booking → validate at booking time.
- Refund for duplicate/chargeback → handle `charge.refunded` webhook.

---

## 10. Security / Compliance

- **PCI:** card data never touches our servers — Stripe handles it (SAQ-A scope).
- **GDPR (if EU):** consent at signup, data-export + deletion endpoint, privacy policy.
- **Auth:** hashed passwords (bcrypt/argon2), CSRF protection, secure sessions.
- **Webhooks:** verify Stripe signature; idempotent handlers.
- **Access control:** admin routes role-gated.
- **Secrets:** Stripe keys + DB creds in env vars / secret manager, never in code.

---

## 11. Pages / UX

- `/` — landing + this week's schedule preview.
- `/schedule` — full calendar (month/week/day views), filter by class type/room.
- `/class/:id` — detail + "Book" button (shows remaining spots).
- `/checkout` — (Stripe-hosted) redirected.
- `/login` / `/signup`.
- `/me` — my bookings, active pass, QR codes.
- `/me/settings` — cancel subscription, delete account.
- `/admin` — class management, booking list, revenue.

---

## 12. Milestones

1. **M1 — Scaffold:** Rust/Axum skeleton + static frontend + Postgres + SQLx migrations + auth. (core plumbing)
2. **M2 — Schedule:** data model + admin CRUD + public calendar (FullCalendar).
3. **M3 — Bookings:** capacity-aware booking + "my bookings" + QR.
4. **M4 — Payments:** Stripe test-mode daily ticket + monthly subscription + webhooks.
5. **M5 — Emails:** confirmations, receipts, reminders.
6. **M6 — Hardening:** edge cases, webhook idempotency, GDPR, tests.
7. **M7 — Deploy:** production env, live Stripe keys, domain + TLS.

---

## 13. Decisions Needed Before Implementation

> Answer Q1–Q20 in §2. The highest-leverage ones:
> **Q5, Q6, Q7** (defines the ticket/pass model) ·
> **Q9, Q10, Q13** (defines payments) ·
> **Q14** (accounts) ·
> **Q18, Q19** (stack & deploy).
