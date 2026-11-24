# Lager www/planter-data.js fra data/planter.json (+ bildeinfo fra data/bilder.json),
# og www/img/filer.json (liste over bilder som lagres for bruk uten nett).
# Kjør på nytt hvis du endrer data:  powershell -File tools\lag-datafil.ps1
$root = Split-Path -Parent $PSScriptRoot
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$bilder = @{}
$bf = Join-Path $root 'data\bilder.json'
if (Test-Path $bf) {
  (Get-Content -Raw -Encoding UTF8 $bf | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $bilder[$_.Name] = $_.Value }
}
$i = 0; $files = New-Object System.Collections.Generic.List[string]
$list = foreach ($p in $data) {
  $i++
  $o = [ordered]@{
    id      = ('p{0:D3}' -f $i)
    gruppe  = $p.gruppe
    latin   = $p.latin
    norsk   = $p.norsk
    sorter  = @($p.sorter)
    status  = $p.status
    merknad = $p.merknad
  }
  $b = $bilder[$p.latin]
  if ($b -and (Test-Path (Join-Path $root ('www\' + $b.fil)))) {
    $o.bilde = [ordered]@{ fil = $b.fil; fotograf = $b.fotograf; lisens = $b.lisens; filside = $b.filside }
    if (-not $files.Contains($b.fil)) { $files.Add($b.fil) }
  }
  $o
}
$utf8 = New-Object System.Text.UTF8Encoding $false
$json = ConvertTo-Json -InputObject @($list) -Depth 6 -Compress
$out = "/* Generert av tools/lag-datafil.ps1 - original planteliste */`nwindow.PLANTER_ORIGINAL = $json;`n"
[System.IO.File]::WriteAllText((Join-Path $root 'www\planter-data.js'), $out, $utf8)
New-Item -ItemType Directory -Force (Join-Path $root 'www\img') | Out-Null
[System.IO.File]::WriteAllText((Join-Path $root 'www\img\filer.json'), (ConvertTo-Json -InputObject @($files) -Compress), $utf8)
"Skrev $i planter ($($files.Count) med bilde) til www/planter-data.js"
