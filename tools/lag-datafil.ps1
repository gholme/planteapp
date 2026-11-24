# Lager www/planter-data.js fra data/planter.json.
# Kjør på nytt hvis du endrer data/planter.json:  powershell -File tools\lag-datafil.ps1
$root = Split-Path -Parent $PSScriptRoot
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$i = 0
$list = foreach ($p in $data) {
  $i++
  [ordered]@{
    id      = ('p{0:D3}' -f $i)
    gruppe  = $p.gruppe
    latin   = $p.latin
    norsk   = $p.norsk
    sorter  = @($p.sorter)
    status  = $p.status
    merknad = $p.merknad
  }
}
$json = ConvertTo-Json -InputObject @($list) -Depth 5 -Compress
$out = "/* Generert av tools/lag-datafil.ps1 - original planteliste */`nwindow.PLANTER_ORIGINAL = $json;`n"
$target = Join-Path $root 'www\planter-data.js'
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
[System.IO.File]::WriteAllText($target, $out, (New-Object System.Text.UTF8Encoding $false))
"Skrev $i planter til $target"
