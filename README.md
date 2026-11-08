# aTerem — weboldal-prototípus (változatok)

Nyilvános, statikus prototípus a **aTerem** (Székesfehérvár, Távirda utca 9.)
csoportos edzőterem weboldalához. Nem tartalmaz regisztrációt, bejelentkezést,
foglalást vagy fizetést — a cél a megjelenés és a későbbi foglalási/bérlet
rendszer frontend-alapjának bemutatása.

## Struktúra

```
index.html                 — landing oldal (a változatok listája)
css/landing.css            — landing stílus
js/landing.js              — landing viselkedés (variants.json betöltése)
variants.json              — a változatok listája (adatmodell)
variants/
  v1-alap/                 — „Változat 1 — alap" (a jelenlegi megjelenés)
    index.html
    css/style.css
    js/main.js
    data/class-types.json  — óratípusok (később DB-re cserélhető)
    data/schedule.json     — órarend eseményei + bizonytalan időpontok
Dockerfile                 — opcionális „tiszta" deploy (nginx)
```

**Új változat hozzáadása:** hozz létre egy új mappát a `variants/` alatt
(pl. `variants/v2-uj/`), és vegyél fel egy bejegyzést a `variants.json`-ba —
a landing oldal automatikusan listázza.

## Futtatás

A prototípus adatvezérelt: a `*.json` fájlokat `fetch`-csel tölti be, ezért
**helyi szerverrel** kell megnyitni (a `file://` megnyitás nem elég).

```bash
# a projekt gyökeréből
python3 -m http.server 8000
# majd: http://localhost:8000
```

Nincs build lépés, nincs függőség — tiszta HTML + CSS + vanilla JS.

## Adatmodell (későbbi backend/DB előkészítése)

- **Óratípus** (`variants/v1-alap/data/class-types.json`): `id`, `name`,
  `tagline`, `description`, `color`, `image` — a megjelenítés ebből olvas,
  üzleti logikát nem tartalmaz.
- **Órarendi esemény** (`.../data/schedule.json` → `events`): `id`,
  `classTypeId` (hivatkozás az óratípusra), `date` (YYYY-MM-DD), `start`,
  `end` — a dátum és időpont külön mező. Később ez kerül a backend API/DB mögé.
- **Bizonytalan adatok** (`.../data/schedule.json` → `uncertain`): a régi
  oldalról kimásolt, de órához nem rendelhető időpontok — külön vannak
  választva a biztos (itt: minta-) eseményektől.

## Fontos: minta-órarend

A `schedule.json` eseményei **illusztrációk** (`demo: true`), hogy a naptár
megjelenését be lehessen mutatni. A felületen „Minta órarend” jelölés látható.

**A pontos órarendhez még szükséges adatok:**

1. Minden órához a pontos **dátum + kezdési időpont + időtartam** (vagy a heti
   ismétlődő minta).
2. A **2026. november 16–22.** heti `17:00–18:00` és `19:30–20:30` időpontok
   **órához rendelése** (jelenleg a „Bizonytalan időpontok” blokkban vannak).
3. Oktató- és terem-hozzárendelés (ha később megjelenítjük).
4. A stúdió **saját fotói** (a jelenlegi képek Unsplash placeholder-ek; a
   trambulin és TRX kártyához nincs megfelelő stock fotó).

## Képek

A fotók az Unsplash-ről töltődnek be (ingyenes licencű illusztrációk). A
végleges oldalon a stúdió saját, jogtiszta fotóit érdemes használni — a cseréhez
a `data/class-types.json` `image` mezőit és a `css/style.css` hero/rólunk
hátterét kell módosítani.

## Kapcsolat / adatok

- Cím: Székesfehérvár, Távirda utca 9.
- Telefon: +36 30 643 4361
- E-mail: info@a-terem.hu
- Facebook: https://www.facebook.com/ateremtavirda/
- Instagram: https://www.instagram.com/ateremszekesfehervar/
