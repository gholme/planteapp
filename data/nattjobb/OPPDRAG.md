# Oppdrag: planteinfo med faktasjekk

Du fyller inn planteinfo for en gruppe planter i en øve-app for en gutt som lærer plantenavn.
Gutten leser dårlig og får teksten lest opp. Forelderen kan ikke vurdere verdiene selv.
Derfor er **faktasjekk mot kilder hele poenget**. En tom verdi er bedre enn en gjetning.

## Mønster
Les `E:\Code\PlanteApp\data\planteinfo.json`. Den har 7 ferdige spireaer fra piloten. Følg nøyaktig samme
format, feltnavn og stil.

## Kilder
Bruk bare sikre kilder, og les dem selv med WebFetch eller WebSearch:
- Artsdatabanken (navn og fremmedartslista: artsdatabanken.no, lister.artsdatabanken.no/fremmedartslista/2023)
- Store norske leksikon (snl.no)
- Plantinor (plantinor.no)
- NIBIO
- NMBU
- E-planta eller Gröna Fakta (SLU/Movium)
- RHS (rhs.org.uk)
- Hageselskapet
- Norsk Gartnerforbund
- Større norske planteskoler med faktaark, som hekkplanter.no og Splendor Plant
- Wikipedia bare som støtte, ikke alene

Andre regler:
- Ikke bruk nettbutikker uten faktaark, blogger eller AI-generert innhold.
- Et felt får verdi bare hvis du har sett verdien i minst én kilde du faktisk har åpnet. Hukommelse er ikke en kilde.
- Oppgi kildenumrene i `feltkilder`.
- Er kildene uenige, velg det de fleste sier, eller et spenn som dekker dem. Skriv uenigheten i `usikkert`.
- Finner du ingenting, sett `null` og skriv det i `usikkert`.

## Felter (samme som piloten)
`status` ("kontrollert"), `kontrollert` ("25.11.2026 mot kildene under"), `navn_artsdatabanken`, `norsk_navn_kilde`,
`plantetype`, `lovfelling`, `hoyde_cm` [min,max], `bredde_cm` [min,max], `veksthastighet`, `blomsterfarge` [],
`blomstring_mnd` [fra,til] (1–12), `bladverk`, `lys` [], `jord`, `herdighet_maks` (tall 1–8, norsk H-sone: tåler H1 til Hn),
`planteavstand_cm` [min,max], `planteavstand_merknad`, `beskjaering`, `bruksomrade` [], `egenskaper` [], `opprinnelse`,
`beskrivelse`, `kjennetegn` [], `forveksling`, `giftig`, `spiselig`, `hostfarge`, `vinterpynt`,
`fremmedart` {kategori, aar, merknad} eller null, `kilder` [{nr, tittel, url}], `feltkilder` {felt: [nr]}, `usikkert` [].

I tillegg kommer et nytt felt, `navneavvik`. Det er `null`, eller én kort setning når norsk navn i lista avviker fra
Artsdatabanken eller SNL. Eksempel: «Artsdatabanken kaller den X, lista sier Y.» Ikke bytt navn selv.

Faste ordlister (filtrene i appen bruker disse):
- `plantetype`: «tre», «busk», «dvergbusk», «staude», «klatreplante»
- `lovfelling`: «løvfellende», «eviggrønn», «vintergrønn», eller `null` for stauder
- `blomsterfarge`: hvit, krem, gul, oransje, rød, rosa, mørkerosa, lilla, fiolett, blå, grønn, brun.
  Bruk ikke-iøynefallende blomster bare hvis de er pynt. Ellers `[]`.
- `lys`: «sol», «halvskygge», «skygge»
- `veksthastighet`: «langsom», «middels», «rask» eller to av dem med tankestrek, som «middels–rask»
- `fremmedart.kategori`: Artsdatabankens koder SE, HI, PH, LO, NK. Hjemmehørende arter får `null` (skriv
  «Viltvoksende i Norge» i `opprinnelse`). Arter som ikke er vurdert får også `null`.

## Slekter, hybrider og fruktsorter
Noen linjer er en hel slekt eller gruppe, for eksempel «Rosa», «Allium», «Hosta», «Malus (prydepler)», «Sorbus (hybrider)»
og «Prunus (hybrider)». Fyll da bare inn det som gjelder hele gruppen eller sortene i lista, gjerne som et bredt spenn.
Skriv i `usikkert` at verdiene varierer mellom sortene. Er det for sprikende, sett `null`. Bruk sortene i lista som
holdepunkt. For fruktsorter er herdighet per sort ofte oppgitt i Plantinor og hos NIBIO. Oppgi spennet og nevn det.

Nøkkelen i JSON skal være **nøyaktig** latin-teksten fra gruppelista, også spesialtegn som × og ' og (hybrider).

## Lettlest tekst (viktig, teksten leses opp)
- Korte, enkle setninger, slik en tiåring forstår.
- `beskrivelse`: 1–2 setninger.
- `kjennetegn`: 2–4 korte punkter.
- **Ingen forkortelser**: ikke ca., f.eks., bl.a., evt., osv., dvs., o.l., mm. og ikke «S.» eller «P.» for en slekt.
  Skriv slektsnavnet helt, som «Spiraea trilobata».
- Ikke koder som LO, PH eller HI i fritekst. Skriv «lav risiko» og lignende med ord.
- Mål skrives som «3–5 cm» eller «2 m». Det er greit.
- Unngå parenteser når det går. Skriv heller en ekstra setning.
- Fagord forklares eller byttes ut, for eksempel «blomstrer på fjorårets skudd».

## Leveranse
1. Skriv resultatet med Write-verktøyet til `E:\Code\PlanteApp\data\nattjobb\del-<GRUPPE>.json`.
   Det skal være ett JSON-objekt med latin som nøkkel, i UTF-8, og gyldig JSON. Les filen tilbake og kontroller at
   den parser. Bruk vanlige doble anførselstegn i JSON. Sitater inne i tekst skrives med «».
2. Svar til slutt med en kort rapport på norsk, høyst 15 linjer:
   - hvor mange planter som er fylt inn
   - alle navneavvik
   - planter der nesten alt ble `null`
   - andre ting forelderen bør vite

Ikke rediger andre filer i prosjektet.
