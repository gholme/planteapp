# Publisere Planteøving på GitHub Pages

Appen publiseres fra mappen `www/` til en adresse som `https://<brukernavn>.github.io/planteapp/`.
Det skjer automatisk (GitHub Actions, se `.github/workflows/pages.yml`) hver gang du pusher til `main`.

> **NB:** Gratis GitHub Pages krever et **offentlig** repo. Alt i mappen blir synlig, også
> `Kontrolliste_planter.xlsx` og `data/planter.json`. Det er ingenting personlig der, men flytt filer
> ut av mappen før publisering hvis du ikke vil ha dem med.

## 1. Lag GitHub-konto (ca. 5 min)

1. Gå til **https://github.com/signup**.
2. Skriv inn e-post, passord og **brukernavn**. Brukernavnet blir en del av adressen
   (`brukernavn.github.io`), så velg noe du er komfortabel med å dele.
3. Løs oppgaven («verify you are human») og bekreft koden som kommer på e-post.
4. Velg **Free** når du blir spurt om plan.
5. Anbefalt: slå på totrinnsbekreftelse under *Settings → Password and authentication*.

## 2. Installer GitHub Desktop

Enklest for å komme i gang (inneholder git, ingen kommandolinje nødvendig):

```powershell
winget install GitHub.GitHubDesktop
```

Eller last ned fra https://desktop.github.com. Start programmet og logg inn med kontoen fra steg 1.

## 3. Lag repoet og publiser

1. I GitHub Desktop: **File → Add local repository…** → velg `E:\Code\PlanteApp`.
2. Den sier at mappen ikke er et git-repo → klikk **create a repository**.
   - Name: `planteapp` (blir siste del av adressen)
   - Git ignore / License: la stå som *None* (det finnes allerede en `.gitignore`)
   - Klikk **Create repository**.
3. Klikk **Publish repository** øverst.
   - **Fjern haken** for *Keep this code private* (Pages krever offentlig repo på gratiskonto).
   - Klikk **Publish repository**.

## 4. Slå på GitHub Pages (én gang)

1. Gå til repoet på github.com (*Repository → View on GitHub* i GitHub Desktop).
2. **Settings → Pages**.
3. Under *Build and deployment → Source*: velg **GitHub Actions**.
4. Gå til fanen **Actions**. Hvis jobben «Publiser til GitHub Pages» ikke allerede har kjørt grønt,
   velg den og klikk **Run workflow**.
5. Etter ca. 1 minutt står adressen under *Settings → Pages*:
   `https://<brukernavn>.github.io/planteapp/`

## 5. Installer på telefonen (Android)

1. Åpne adressen i **Chrome** på telefonen (send den på SMS/e-post, eller skann en QR-kode).
2. Trykk **⋮ → Installer app** (eller «Legg til på startsiden» → «Installer»).
3. Ikonet med det grønne bladet dukker opp blant appene. Den åpner i fullskjerm og virker uten nett.

## Oppdatere appen senere

1. Gjør endringer (eller be Claude om det).
2. I GitHub Desktop: skriv en kort beskrivelse nede til venstre → **Commit to main** → **Push origin**.
3. Etter ca. 1 minutt er ny versjon ute. Telefonen henter den neste gang appen åpnes med nett.
   Fremgang og egne navneendringer på telefonen beholdes.

> Endrer du standardlisten i `data/planter.json`, kjør `powershell -File tools\lag-datafil.ps1` før commit.
> En telefon som allerede har egne endringer i listen, beholder sin egen liste.

## Teste lokalt før publisering

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\server.ps1
```

Åpne http://localhost:8765/ i Chrome.
