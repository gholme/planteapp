# Kontrollerer planteinfo (data/planteinfo.json, eller filene gitt med -Filer) før de tas i bruk:
#  - gyldig JSON og nøkler som finnes i data/planter.json
#  - faste ordlister, tall og spenn
#  - at hvert utfylt felt har kilde, og at kildenumrene finnes
#  - forkortelser og kortkoder i tekst som leses opp
param([string[]]$Filer)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Filer) { $Filer = @(Join-Path $root 'data\planteinfo.json') }
$planter = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$latin = @($planter | ForEach-Object { $_.latin })

$typer = 'tre','busk','dvergbusk','staude','klatreplante'
$lov = 'løvfellende','eviggrønn','vintergrønn'
$farger = 'hvit','krem','gul','oransje','rød','rosa','mørkerosa','lilla','fiolett','blå','grønn','brun'
$lysOk = 'sol','halvskygge','skygge'
$vekst = 'langsom','middels','rask','langsom–middels','middels–rask'
$kat = 'SE','HI','PH','LO','NK'
$tekstfelt = 'bladverk','jord','beskjaering','opprinnelse','beskrivelse','forveksling','giftig','spiselig','hostfarge','vinterpynt','planteavstand_merknad'
$utenKilde = 'status','kontrollert','kilder','feltkilder','usikkert','navneavvik','planteavstand_merknad','navn_artsdatabanken'
$forkort = '\bca\.|\bf\.eks|\bbl\.a\.|\bevt\.|\bosv\b|\bdvs\b|\bo\.l\.|\bmm\.|\bspp?\.|\b[A-Z]\.\s?[a-z×]|\b(SE|HI|PH|LO|NK)\b'

$feil = New-Object System.Collections.Generic.List[string]
$n = 0; $domener = @{}
function Test-Range($v) { return ($v -is [array]) -and $v.Count -eq 2 -and ($v[0] -is [ValueType]) -and ($v[1] -is [ValueType]) -and $v[0] -le $v[1] }

foreach ($fil in $Filer) {
  try { $data = Get-Content -Raw -Encoding UTF8 $fil | ConvertFrom-Json } catch { $feil.Add("$(Split-Path -Leaf $fil): ugyldig JSON – $($_.Exception.Message)"); continue }
  foreach ($navn in $data.PSObject.Properties.Name) {
    $n++; $o = $data.$navn; $t = "$navn"
    function F($m) { $feil.Add("$t – $m") }
    if ($latin -notcontains $navn) { F 'nøkkelen finnes ikke i planter.json' }
    if ($o.plantetype -and $typer -notcontains $o.plantetype) { F "plantetype «$($o.plantetype)»" }
    if ($o.lovfelling -and $lov -notcontains $o.lovfelling) { F "lovfelling «$($o.lovfelling)»" }
    foreach ($c in @($o.blomsterfarge)) { if ($c -and $farger -notcontains $c) { F "blomsterfarge «$c»" } }
    foreach ($c in @($o.lys)) { if ($c -and $lysOk -notcontains $c) { F "lys «$c»" } }
    if ($o.veksthastighet -and $vekst -notcontains $o.veksthastighet) { F "veksthastighet «$($o.veksthastighet)»" }
    foreach ($k in 'hoyde_cm','bredde_cm','planteavstand_cm') { if ($null -ne $o.$k -and -not (Test-Range $o.$k)) { F "$k er ikke [min,max]" } }
    if ($null -ne $o.blomstring_mnd) { $m = $o.blomstring_mnd; if (-not (Test-Range $m) -or $m[0] -lt 1 -or $m[1] -gt 12) { F 'blomstring_mnd' } }
    if ($null -ne $o.herdighet_maks -and ($o.herdighet_maks -isnot [ValueType] -or $o.herdighet_maks -lt 1 -or $o.herdighet_maks -gt 8)) { F "herdighet_maks «$($o.herdighet_maks)»" }
    if ($o.fremmedart -and $kat -notcontains $o.fremmedart.kategori) { F "fremmedart.kategori «$($o.fremmedart.kategori)»" }
    $nr = @($o.kilder | ForEach-Object { [int]$_.nr })
    foreach ($k in @($o.kilder)) { if ($k.url -match '^https?://([^/]+)') { $d = $matches[1] -replace '^www\.', ''; $domener[$d] = 1 + [int]$domener[$d] } else { F "kilde uten gyldig url: $($k.tittel)" } }
    foreach ($p in $o.PSObject.Properties) {
      $v = $p.Value
      $tom = ($null -eq $v) -or ($v -is [string] -and -not $v) -or ($v -is [array] -and $v.Count -eq 0)
      if ($tom -or $utenKilde -contains $p.Name) { continue }
      $fk = $o.feltkilder.($p.Name)
      if (-not $fk) { F "$($p.Name) har verdi, men ingen kilde"; continue }
      foreach ($x in @($fk)) { if ($nr -notcontains [int]$x) { F "$($p.Name) viser til kilde $x som ikke finnes" } }
    }
    $tekst = @($tekstfelt | ForEach-Object { $o.$_ }) + @($o.kjennetegn) + @($o.bruksomrade) + @($o.egenskaper)
    if ($o.fremmedart) { $tekst += $o.fremmedart.merknad }
    foreach ($s in $tekst) { if ($s -and ($s -cmatch $forkort)) { F "forkortelse eller kode i tekst: «$($matches[0])» i «$s»" } }
  }
}
"Kontrollert $n planter i $($Filer.Count) fil(er)."
if ($feil.Count) { "FEIL ($($feil.Count)):"; $feil } else { 'Ingen feil.' }
''
'Kilder brukt (domene: antall):'
$domener.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "  $($_.Key): $($_.Value)" }
