# Henter ett bilde per plante fra Wikipedia (hovedbildet på artikkelen) og lagrer
# en liten versjon i www/img/. Lisens og fotograf hentes fra Wikimedia Commons.
# Resultat: data/bilder.json (nøkkel = latinsk navn).
#
# Bytte bilde for én plante: legg inn i data/bilde-overstyring.json
#   { "Fagus sylvatica f. purpurea": "File:Navn_på_fil.jpg" }   eller   { "...": "Artikkeltittel" }
# og kjør skriptet på nytt med -Bare "Fagus sylvatica f. purpurea".
#   Alle overstyrte på én gang:  -Overstyrte
param([string[]]$Bare = @(), [switch]$Overstyrte, [int]$Bredde = 480)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$UA = @{ 'User-Agent' = 'PlanteApp/1.0 (private educational flashcard app)' }
$imgDir = Join-Path $root 'www\img'
New-Item -ItemType Directory -Force $imgDir | Out-Null

$planter = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$outFile = Join-Path $root 'data\bilder.json'
$result = @{}
if (Test-Path $outFile) {
  (Get-Content -Raw -Encoding UTF8 $outFile | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $result[$_.Name] = $_.Value }
}
$over = @{}
$overFile = Join-Path $root 'data\bilde-overstyring.json'
if (Test-Path $overFile) {
  (Get-Content -Raw -Encoding UTF8 $overFile | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $over[$_.Name] = $_.Value }
}

if ($Overstyrte) { $Bare = @($over.Keys) }

function Get-Json($url) {
  for ($i = 0; $i -lt 6; $i++) {
    try { return Invoke-RestMethod -Uri $url -Headers $UA -TimeoutSec 30 } catch { Start-Sleep -Seconds (4 * ($i + 1)) }
  }
  throw "Feilet: $url"
}
function Get-Candidates([string]$latin) {
  $clean = $latin -replace "\s*\(.*?\)", '' -replace '×', '' -replace '\s+', ' '
  $noCult = ($clean -replace "'[^']*'", '').Trim()
  $words = $noCult.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
  $c = New-Object System.Collections.Generic.List[string]
  $c.Add($clean.Trim()); $c.Add($noCult)
  if ($words.Count -ge 2) { $c.Add("$($words[0]) $($words[1])") }
  $c.Add($words[0])
  return $c | Select-Object -Unique
}
# Wikipedia-oppslag: artikkeltittel -> filnavn for hovedbilde
function Find-PageImage([string]$title) {
  $t = [Uri]::EscapeDataString($title)
  $j = Get-Json "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name&titles=$t"
  foreach ($p in $j.query.pages.PSObject.Properties.Value) {
    if ($p.pageimage) { return @{ file = "File:$($p.pageimage)"; page = $p.title } }
  }
  return $null
}
# Søk etter foto (JPEG) på Commons: første treff.
function Find-CommonsPhoto([string]$q) {
  $t = [Uri]::EscapeDataString("$q filemime:image/jpeg")
  $j = Get-Json "https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=1&srsearch=$t"
  $r = $j.query.search | Select-Object -First 1
  if ($r) { return @{ file = $r.title; page = '' } }
  return $null
}
function Get-FileInfo([string]$file) {
  $t = [Uri]::EscapeDataString($file)
  $j = Get-Json "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=$Bredde&titles=$t"
  $p = $j.query.pages.PSObject.Properties.Value | Select-Object -First 1
  if (-not $p.imageinfo) { return $null }
  $ii = $p.imageinfo[0]; $m = $ii.extmetadata
  $artist = if ($m.Artist) { ($m.Artist.value -replace '<[^>]+>', '').Trim() } else { 'Wikimedia Commons' }
  return @{
    thumb = $ii.thumburl; filePage = $ii.descriptionurl; mime = $ii.mime
    artist = $artist
    license = if ($m.LicenseShortName) { $m.LicenseShortName.value } else { '' }
    licenseUrl = if ($m.LicenseUrl) { $m.LicenseUrl.value } else { '' }
  }
}

function Save-Result {
  $sorted = [ordered]@{}
  foreach ($k in ($result.Keys | Sort-Object)) { $sorted[$k] = $result[$k] }
  [System.IO.File]::WriteAllText($outFile, ($sorted | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding $false))
}

$i = 0
foreach ($p in $planter) {
  $i++
  $latin = $p.latin
  if ($Bare.Count -and $Bare -notcontains $latin) { continue }
  if (-not $Bare.Count -and $result.ContainsKey($latin)) { continue }

  $hit = $null
  if ($over.ContainsKey($latin)) {
    $o = [string]$over[$latin]
    if ($o -like 'File:*') { $hit = @{ file = $o; page = '' } }
    elseif ($o -like 'search:*') { $hit = Find-CommonsPhoto $o.Substring(7) }
    else { $hit = Find-PageImage $o }
  }
  if (-not $hit) {
    foreach ($cand in (Get-Candidates $latin)) { $hit = Find-PageImage $cand; if ($hit) { break } }
  }
  if (-not $hit) { Write-Host ("{0,3} MANGLER  {1}" -f $i, $latin); continue }
  $info = Get-FileInfo $hit.file
  if (-not $info -or -not $info.thumb) { Write-Host ("{0,3} INGEN FIL {1} ({2})" -f $i, $latin, $hit.file); continue }

  $slug = ($latin.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  $ext = if ($info.thumb -match '\.png($|\?)') { 'png' } else { 'jpg' }
  $name = "$slug.$ext"
  Invoke-WebRequest -Uri $info.thumb -Headers $UA -OutFile (Join-Path $imgDir $name) -TimeoutSec 60 -UseBasicParsing
  $result[$latin] = [ordered]@{
    fil = "img/$name"; side = $hit.page; kildefil = $hit.file
    filside = $info.filePage; fotograf = $info.artist; lisens = $info.license; lisensUrl = $info.licenseUrl
  }
  Write-Host ("{0,3} OK  {1}  <- {2}" -f $i, $latin, $hit.file)
  Save-Result
  Start-Sleep -Milliseconds 500
}
Save-Result
"Lagret $($result.Count) bilder i data/bilder.json"
