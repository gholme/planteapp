# Nattjobben – rapport (25.11.2026)

Alle 124 plantene har nå planteinfo. De 7 spireaene er fra piloten, og 117 er nye. Ti Fable-agenter har
faktasjekket hver sin gruppe mot kilder de faktisk har åpnet. Hvert utfylt felt viser hvilke kilder det bygger på.

## Kontroll

- `tools\sjekk-planteinfo.ps1` fant **ingen feil** i sluttresultatet. Det sjekker:
  - at alle felt har kilde
  - faste ordlister og tall
  - at teksten ikke har forkortelser eller koder
- To felt er tatt bort ved kontrollen:
  - Opprinnelsen til Coreopsis kom bare fra et søketreff.
  - Herdigheten til trompettreet kom bare fra Wikipedia.
- Fire ufarlige felt bygger bare på Wikipedia:
  - opprinnelse for Pyrus salicifolia, Prunus × cistena og Salix integra
  - at eple er løvfellende
- **Opplesningstest:** Alle 248 Les opp-knapper på 124 plantesider er testet. Det er ingen rester av forkortelser,
  koder, tankestreker eller parenteser. To regler i opplesningen ble rettet underveis: «50 centimeter til 1 meter»
  og en dobbel punktum.
- **Kilder:** Plantinor (203), RHS (175), Artsdatabanken (216), SNL (87), Trees and Shrubs Online, hekkplanter.no,
  E-planta, Hageselskapet og Norsk Roseforening. Wikipedia er brukt bare som støtte (15 ganger).
- **Websøk-kvoten** tok slutt for flere agenter mot slutten. De gikk da over til å åpne sidene direkte. Noen sorter
  ble derfor ikke sjekket hver for seg.

## Navn – avvik mot Artsdatabanken (59)

Ingen navn er endret. Appen viser allerede «Navn hos Artsdatabanken» på plantesiden når navnene er ulike.
Hele listen står i Excel-arket (raden «Navneavvik mot lista») og i `data\planteinfo.json` (`navneavvik`).

### Bør vurderes: navnet hører til en annen plante, eller finnes ikke i noen kilde
| Latin | Lista | Hva kildene sier |
|---|---|---|
| Ribes glandulosum | Kjertelrips | Kjertelrips er en annen plante. Plantinor: kryprips |
| Cotoneaster × suecicus | Krypmispel | Krypmispel er Cotoneaster horizontalis. Artsdatabanken: vintermispel |
| Leucanthemum × superbum | Prestekrage | Prestekrage er den ville arten. Artsdatabanken og SNL: kjempekrage |
| Tilia × europaea | Lind | Lind er Tilia cordata. Artsdatabanken og SNL: parklind |
| Echinacea purpurea | Solhatt | SNL bruker solhatt om Rudbeckia. Artsdatabanken og SNL: purpursolhatt |
| Corylus avellana 'Contorta' | Trollhassel | SNL bruker trollhassel om Hamamelis. Plantinor: vrihassel |
| Acer palmatum | Japansk lønn | Japanlønn er Acer japonicum. Artsdatabanken: viftelønn |
| Symphoricarpos × doorenbosii | Snøbær | Snøbær er Symphoricarpos albus. Plantinor: hagesnøbær |
| Sorbus koehneana | Kinarogn | Ikke funnet. Artsdatabanken: kvitrogn |
| Prunus maackii | Gullhegg | Ikke funnet. Artsdatabanken: neverhegg |
| Robinia pseudoacacia | Uekte akasie | Ikke funnet. Artsdatabanken og SNL: robinia |
| Kolkwitzia amabilis | Perlemorbusk | Ikke funnet. Artsdatabanken: fagerbusk |
| Hydrangea arborescens | Skoghortensia | Ikke funnet. Artsdatabanken: vierhortensia |
| Potentilla tridentata | Tretannmure | Ikke funnet. Artsdatabanken: grønlandsmure |
| Cimicifuga | Sølvlys | Ikke funnet. Plantinor: oktoberormedrue |

### Kortere eller vanlige handelsnavn (trolig greit å beholde)
De øvrige 44 er navn som lista forkorter eller skriver litt annerledes, for eksempel:
- Søtkirsebær og morell, Rips og hagerips, Eple og hageeple, Floks og høstfloks, Peon og silkepion
- Forsytia og praktgullbusk, Weigela og roseklokkebusk, Japansk lerk og japanlerk, Ungarsk syrin og ungarnsyrin
- Prydkirsebær for tre ulike arter, og Syrin alene for Syringa wolfii, × henryi og komarowii

## Latinske navn som har endret seg (ikke rørt)
- Dicentra spectabilis heter nå Lamprocapnos spectabilis.
- Ribes grossularia heter nå Ribes uva-crispa.
- Parthenocissus vitacea heter nå Parthenocissus inserta.
- Perovskia atriplicifolia heter nå Salvia yangii.
- Stephanandra incisa heter nå Neillia incisa.
- Cornus alba heter nå Swida alba.
- Potentilla tridentata heter nå Sibbaldia tridentata.
- Cimicifuga 'Brunette' heter nå Actaea simplex.

## Sorter som kanskje står under feil art i lista
- Philadelphus 'Mont Blanc' og 'Manteau d'Hermine' er Lemoinei-hybrider, ikke Philadelphus coronarius.
- Symphoricarpos 'Arvid' er Symphoricarpos albus, som har høy risiko på Fremmedartslista.
- Weigela 'Red Prince' og 'Ebony & Ivory' er hybrider, ikke Weigela florida.
- Lonicera 'Kirke' er vanlig blåleddved til hekk. Plantinor sier at bærene ikke er spiselige.
- Prunus 'Brilliant' hører til kurilensis, ikke incisa.
- Aronia 'Moskva' er ifølge Plantinor en hybridsurbær.

## Tynne planter
- **Ingen herdighetssone funnet (16):**
  - Prunus nipponica var. kurilensis, Prunus cerasifera 'Nigra' og Prunus × cistena
  - Catalpa, Robinia, Syringa wolfii, Syringa × henryi og Syringa (hybrider)
  - Salix 'Brekkavier' og Salix integra 'Hakuro-nishiki'
  - vindrue, rabarbra og asparges
  - Astilbe, peon og Rosa
  
  Disse vises ikke på «Min sone».
- **Nesten tomme:** Syringa × henryi og Salix 'Brekkavier'. Bare nettbutikker hadde tall for dem.
- **Rosa og fruktsortene:** Slektene har store spenn. Herdighet og høyde varierer per sort, og det står i
  «usikkert». Bare noen få av de rundt 70 rosesortene og fruktsortene er sjekket hver for seg.

## Plantetype som avviker fra gruppen i lista
- Magnolia stellata, Magnolia-hybridene, Prunus incisa og Caragana arborescens står under Trær, men kildene kaller
  dem busker.
- Lavendel (dvergbusk) og Perovskia (busk) står under Stauder.

Dette påvirker bare filteret «Type», ikke øvingsgruppene.

## Filer
- `data\planteinfo.json` har 124 planter. Kopi av pilotversjonen ligger i scratchpad.
- `www\planter-data.js` er laget på nytt.
- `Kontrolliste_planteinfo.xlsx` har 124 kolonner, med kilder og usikre felt.
- Agentenes rådata ligger i `data\nattjobb\del-A.json` til `del-J.json`.
