# Planteøving

En enkel app for å lære plantenavn (latin ↔ norsk). Ren HTML/CSS/JavaScript uten avhengigheter
og uten byggesteg. Den virker offline og lagrer alt lokalt på enheten (localStorage).

## Innhold

| Fil / mappe | Hva |
|---|---|
| `www/` | Selve appen. Dette er alt som skal inn i APK-en. |
| `www/planter-data.js` | Original planteliste (genereres – ikke rediger for hånd). |
| `data/planter.json` | Master for plantelisten (124 kort, ryddet fra OCR-lista). |
| `Kontrolliste_planter.xlsx` | Kontrolliste for gjennomgang: Sjekk / Rettet / OK. |
| `tools/lag-datafil.ps1` | Lager `www/planter-data.js` fra `data/planter.json`. |
| `tools/server.ps1` | Liten lokal webserver for testing på PC. |
| `tools/lag-ikoner.ps1` | Lager app-ikonene i `www/icons/`. |
| `tools/hent-bilder.ps1` | Henter plantebilder fra Wikipedia/Commons til `www/img/` og lisensinfo til `data/bilder.json`. |
| `data/bilde-overstyring.json` | Velg et annet bilde for en plante (artikkel eller `File:`-navn på Commons). |
| `tools/kontaktark.ps1` | Lager oversiktsark over alle bildene for kontroll. |
| `tools/komprimer-bilder.ps1` | Krymper bildene (480 px, JPEG 78) – kjør etter nye bilder. |
| `data/planteinfo.json` | Planteinfo (høyde, blomstring, herdighet, kjennetegn …) med kilder per felt. Nøkkel = latinsk navn. |
| `tools/lag-infoliste.ps1` | Lager `Kontrolliste_planteinfo.xlsx` (verdier med kildenummer, kilder, usikre felt). |
| `.github/workflows/pages.yml` | Publiserer `www/` til GitHub Pages ved push til `main`. |
| `DEPLOY.md` | Steg for steg: konto, publisering og installasjon på telefon. |

## Teste på PC

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\server.ps1
```

Åpne http://localhost:8765/ i nettleseren. Bruk mobilvisning i utviklerverktøyene (F12) for å se den som på telefon.

## Endre plantelisten

- **På telefonen:** Plantelisten → trykk på en plante → endre → Lagre. «＋ Ny» legger til.
  Endringene lagres bare på den telefonen. Bruk *Sikkerhetskopi → Kopier/Del* for å ta vare på dem.
- **I kildekoden (ny standardliste):** rediger `data/planter.json` og kjør
  `powershell -File tools\lag-datafil.ps1`. NB: en telefon som allerede har egne endringer
  beholder sin egen liste til man trykker «Gå tilbake til original planteliste».

## Bilder

Bildene kommer fra Wikipedia/Wikimedia Commons under fri lisens (fotograf og lisens vises under bildet og
på siden «Om bildene» i appen). Bytte et bilde:

1. Finn et bedre bilde på commons.wikimedia.org og kopier filnavnet (`File:...jpg`).
2. Legg det inn i `data/bilde-overstyring.json`, f.eks. `{ "Fagus sylvatica f. purpurea": "File:Fagus sylvatica purpurea.jpg" }`.
3. Kjør `powershell -File tools\hent-bilder.ps1 -Bare "Fagus sylvatica f. purpurea"` og deretter `tools\lag-datafil.ps1`.

## Funksjoner

- Tre øvingsmåter: flervalg (med bilde av hvert alternativ), skriv svaret (tåler små skrivefeil) og flashkort.
- 🔊 Opplesning av navn (nettleserens talesyntese, norsk stemme hvis telefonen har det). Kan leses opp automatisk.
- Retning: latin → norsk, norsk → latin eller blandet. Filter på gruppe.
- Smart repetisjon (Leitner-bokser: 0, 1, 2, 4, 7, 14, 30 dager). Feil svar kommer igjen i samme økt.
- Når flere arter har samme norske navn (f.eks. «Prydkirsebær»), godtas alle riktige svar.
- Statistikk per gruppe, «vanskeligst»-liste og dager-på-rad.
- 📍 Min sone: velg herdighetssone H1–H8 (med lenke til klimasonekart.no, Hageselskapet) og se hvilke planter som
  tåler sonen. Kartet vises ikke i appen – det krever tillatelse fra Hageselskapet.
- Redigering av planter, eksport/import av liste og fremgang.

## Publisering

Appen publiseres med GitHub Pages og installeres fra Chrome på Android («Installer app»).
Se [DEPLOY.md](DEPLOY.md). Manifest og service worker (`www/manifest.webmanifest`, `www/sw.js`)
gjør den installerbar og offline-klar. Ikonene lages med `tools/lag-ikoner.ps1`.

## Alternativ: APK

Ikke gjort – bare aktuelt hvis man vil unngå nettadresse. Plan:

1. Installer Microsoft OpenJDK 21 (`winget install Microsoft.OpenJDK.21`).
2. Last ned Android SDK command-line tools, og installer `platform-tools`, `platforms;android-35`
   og `build-tools;35.0.0` med `sdkmanager` (f.eks. til `E:\Android\Sdk`).
3. Lag et lite Android-prosjekt (`android/`) med én `WebView`-aktivitet som laster `www/` fra assets
   via `WebViewAssetLoader` (gir stabil localStorage), med DOM storage på og tilbakeknapp koblet til
   nettleserhistorikken.
4. Bygg en signert release-APK med Gradle, og send `.apk` på e-post. På telefonen: åpne vedlegget,
   tillat «Installer ukjente apper» for e-post-/filappen, og installer.
