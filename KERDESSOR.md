# Kérdéssor — edzőterem weboldal (órarend + foglalás + fizetés)

Ezt a kérdéssort a **terem üzemeltetőjétől** kell megkérdezni. A válaszok
határozzák meg az adatmodellt, a Stripe beállítást és a funkciókat.
A ⭐-gal jelölt kérdések a legkritikusabbak — ezek változtatják meg a rendszer
szerkezetét.

---

## A. Általános

- A1. ⭐ Milyen edzéstípusok vannak? (CrossFit, jóga, egyéb?) Melyik a fő profil?
- A2. Egy helyszín vagy több?
- A3. Nyitvatartás? Mikortól meddig lehet jönni?
- A4. ⭐ Van-e **egyéni használat** (open gym / önálló edzés vezetett órán kívül),
  vagy **csak vezetett órák**? Ez dönti el, hogy a napijegy/bérlet csak órákra
  vagy szabad belépésre is szól.

## B. Órarend

- B1. ⭐ Fix, hetente ismétlődő órarend + alkalmi (egyszeri) órák, vagy csak az egyik?
- B2. Melyek az óratípusok, és minden órához tartozik oktató?
- B3. Hány terem/helyszín van? Kell-e terem szerint szűrni az órarendet?
- B4. Van-e **létszámkorlát** óránként? Ha igen, jellemzően mennyi?
- B5. Kell-e **várólista**, ha betelt egy óra?
- B6. Mennyire előre legyen látható az órarend? (1 hét / 2 hét / hónap)
- B7. Az órák időtartama fix vagy változó?

## C. Napijegy

- C1. ⭐ Mit jelent pontosan a **napijegy**?
  - a) egy konkrét órára szól
  - b) egész napos belépés (azon a napon minden óra)
  - c) óratípusonként külön (CrossFit ≠ jóga)
- C2. Ár napijegyenként? Óratípusonként eltérő vagy egységes?
- C3. A napijegy érvényes-e az **egyéni használatra** (open gym) is, vagy csak órákra?

## D. Bérlet

- D1. ⭐ A havi bérlet **naptári hónapra** szól, vagy **30 nap a vásárlástól**?
- D2. ⭐ Korlátlan (bármennyi óra) vagy **óraszám-korlátos**?
- D3. Milyen bérlettípusok kellenek? (havi, heti, 10 alkalmas bérletcsomag,
  diák/nyugdíjas, páros?)
- D4. ⭐ Automatikus **megújítás (előfizetés)**, vagy egyszeri vásárlás havonta?
- D5. A bérlet tartalmazza-e az **egyéni használatot**?
- D6. Van-e próbaóra / első alkalom ingyenes / bevezető akció?

## E. Fizetés

- E1. Pénznem? (Ft / EUR / más)
- E2. Csak **online bankkártya**, vagy készpénz/helyszíni fizetés is kell?
  (A weboldal alapvetően online kártyás fizetést kezel.)
- E3. ⭐ Van-e **cég / adószám / bankszámla**? (Online kártyás fizetéshez,
  Stripe-hoz szükséges.)
- E4. **Visszatérítési / lemondási szabályok:**
  - no-show (eljön-e a visszatérítés, ha nem jelenik meg)
  - óra elmarad az edzőterem miatt
  - bérlet idő előtti lemondása
- E5. Lemondási határidő: óra előtt hány óráig mondható le ingyenesen?

## F. Számlázás

- F1. ⭐ Kell-e **hivatalos számla** (NAV online számla), vagy elég a
  nyugta / email visszaigazolás?
- F2. **ÁFA-mentes** vagy áfás a szolgáltatás? (Edzőtermi szolgáltatás gyakran
  áfamentes.)
- F3. Ha számla kell: van-e már **számlázó program** (szamlazz.hu, Billingo,
  stb.), amibe integrálni kell?
- F4. Milyen adat kell a vevőtől a számlához? (név, cím; céges vásárlásnál
  adószám)

## G. Foglalás és belépés

- G1. ⭐ Foglalni kell-e **konkrét órára**, vagy bérlet/napijegy vásárlás után
  csak bejön a vendég?
- G2. Beléptetés/ellenőrzés hogyan? (QR kód, névsor, recepciós szkennelés)
- G3. A foglalás lemondható-e, és milyen feltételekkel?

## H. Fiók, admin, értesítések

- H1. Kell-e **regisztráció/fiók**, vagy elég a vendég vásárlás (email megadás)?
- H2. Ki kezeli az órarendet és a bérleteket? Kell-e **admin felület**?
- H3. Milyen **értesítések** kellenek? (visszaigazolás, emlékeztető, óra lemondás)
  — email, SMS, mindkettő?
- H4. Nyelv: magyar, angol, vagy többnyelvű oldal?

## I. Jogi / adatvédelem

- I1. ⭐ GDPR / adatvédelmi tájékoztató, adattörlési kérelem kezelése kell
  (Magyarországon igen).
- I2. Járhatnak-e kiskorúak? (szülői hozzájárulás, adatkezelés)

## J. Projekt

- J1. Van-e határidő / tervezett indulás?
- J2. Költségvetési keret?
- J3. MVP (minimális működő verzió) először, utána bővítés — rendben?

---

## Összefoglaló: miért ezek kellenek

| Funkció | Melyik kérdés dönti el |
|---------|------------------------|
| Napijegy modell | C1, C2, C3 |
| Bérlet modell | D1, D2, D4 |
| Egyéni használat (open gym) | A4, C3, D5 |
| Órarend szerkezete | B1, B4 |
| Foglalás kell-e | G1, B4, B5 |
| Fizetés / Stripe | E1, E2, E3 |
| Számlázás | F1, F2, F3 |
| Visszatérítés | E4, E5 |
| Admin / beléptetés | H2, G2 |
