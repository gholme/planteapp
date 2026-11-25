# Lager Kontrolliste_planteinfo.xlsx fra data/planteinfo.json:
#  - Ark «Planteinfo»: én kolonne per plante, én rad per felt, med kildenummer [n] bak hver verdi.
#  - Ark «Kilder»: alle kilder per plante med lenke.
#  - Ark «Usikkert»: felt der kildene var uenige eller tynne.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$info = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planteinfo.json') | ConvertFrom-Json
$planter = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$out = Join-Path $root 'Kontrolliste_planteinfo.xlsx'
$names = @($info.PSObject.Properties.Name)
$mnd = 'jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'

$fields = @(
  @('navn_artsdatabanken','Navn hos Artsdatabanken'), @('norsk_navn_kilde','Norsk navn (kilde)'), @('plantetype','Plantetype'), @('lovfelling','Løvfellende/vintergrønn'),
  @('hoyde_cm','Høyde (cm)'), @('bredde_cm','Bredde (cm)'), @('veksthastighet','Veksthastighet'),
  @('blomsterfarge','Blomsterfarge'), @('blomstring_mnd','Blomstringstid'), @('bladverk','Bladverk'),
  @('lys','Lys'), @('jord','Jord'), @('herdighet_maks','Herdighet'), @('planteavstand_cm','Planteavstand (cm)'),
  @('beskjaering','Beskjæring'), @('bruksomrade','Bruksområde'), @('egenskaper','Egenskaper'),
  @('opprinnelse','Opprinnelse'), @('beskrivelse','Kort beskrivelse'), @('kjennetegn','Kjennetegn'),
  @('forveksling','Kan forveksles med'), @('giftig','Giftig'), @('spiselig','Spiselig'),
  @('hostfarge','Høstfarge'), @('vinterpynt','Vinterpynt'), @('fremmedart','Fremmedart')
)
function Format-Val($key, $v, $o) {
  if ($null -eq $v) { return '' }
  switch ($key) {
    'hoyde_cm' { return "$($v[0])–$($v[1])" }
    'bredde_cm' { return "$($v[0])–$($v[1])" }
    'planteavstand_cm' { $t = "$($v[0])–$($v[1])"; if ($o.planteavstand_merknad) { $t += " ($($o.planteavstand_merknad))" }; return $t }
    'blomstring_mnd' { return "$($mnd[$v[0]-1])–$($mnd[$v[1]-1])" }
    'herdighet_maks' { return "H1–H$v" }
    'fremmedart' { return (@($v.kategori, $v.merknad) | Where-Object { $_ }) -join ' – ' }
    'kjennetegn' { return (@($v) | ForEach-Object { "• $_" }) -join "`n" }
    default { if ($v -is [array]) { return ($v -join ', ') } else { return [string]$v } }
  }
}

$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Add()
$ws = $wb.Worksheets.Item(1); $ws.Name = 'Planteinfo'
$ws.Cells.Item(1,1).Value2 = 'Felt'
for ($c = 0; $c -lt $names.Count; $c++) {
  $o = $info.($names[$c])
  $p = $planter | Where-Object { $_.latin -eq $names[$c] } | Select-Object -First 1
  $ws.Cells.Item(1, $c + 2).Value2 = "$($names[$c])`n$($p.norsk)"
}
$r = 2
foreach ($f in $fields) {
  $ws.Cells.Item($r, 1).Value2 = $f[1]
  for ($c = 0; $c -lt $names.Count; $c++) {
    $o = $info.($names[$c]); $v = $o.($f[0])
    $txt = Format-Val $f[0] $v $o
    $src = $o.feltkilder.($f[0])
    if ($txt -and $src) { $txt += "  [" + (@($src) -join ',') + "]" }
    if (-not $txt) { $txt = '— (ingen sikker kilde)' }
    $ws.Cells.Item($r, $c + 2).Value2 = $txt
    if ($txt -like '—*') { $ws.Cells.Item($r, $c + 2).Font.Color = 0x808080 }
    $u = @($o.usikkert) | Where-Object { $_ -match "^\W*$($f[0])\b" }
    if ($u) { $ws.Cells.Item($r, $c + 2).Interior.Color = 0x9CE6FF }
  }
  $r++
}
$ws.Cells.Item($r + 1, 1).Value2 = 'Gul celle = kildene var uenige eller tynne (se arket «Usikkert»). [n] = kildenummer i arket «Kilder».'
$ws.Cells.Item($r + 1, 1).Font.Italic = $true
$h = $ws.Range($ws.Cells(1,1), $ws.Cells(1, $names.Count + 1)); $h.Font.Bold = $true; $h.Interior.Color = 0x3D6B2E; $h.Font.Color = 0xFFFFFF
$ws.Columns.Item(1).ColumnWidth = 22; $ws.Columns.Item(1).Font.Bold = $true
for ($c = 0; $c -lt $names.Count; $c++) { $ws.Columns.Item($c + 2).ColumnWidth = 34 }
$all = $ws.Range($ws.Cells(1,1), $ws.Cells($r - 1, $names.Count + 1)); $all.WrapText = $true; $all.VerticalAlignment = -4160
$all.Borders.LineStyle = 1; $all.Borders.Color = 0xD8D8D8
$ws.Activate(); $xl.ActiveWindow.SplitRow = 1; $xl.ActiveWindow.SplitColumn = 1; $xl.ActiveWindow.FreezePanes = $true

$ws2 = $wb.Worksheets.Add([System.Reflection.Missing]::Value, $ws); $ws2.Name = 'Kilder'
$ws2.Cells.Item(1,1).Value2 = 'Plante'; $ws2.Cells.Item(1,2).Value2 = 'Nr'; $ws2.Cells.Item(1,3).Value2 = 'Kilde'; $ws2.Cells.Item(1,4).Value2 = 'Lenke'
$r = 2
foreach ($n in $names) { foreach ($k in @($info.$n.kilder)) {
  $ws2.Cells.Item($r,1).Value2 = $n; $ws2.Cells.Item($r,2).Value2 = [double]$k.nr; $ws2.Cells.Item($r,3).Value2 = $k.tittel
  $ws2.Hyperlinks.Add($ws2.Cells.Item($r,4), $k.url, '', '', $k.url) | Out-Null; $r++ } }
$ws2.Range('A1:D1').Font.Bold = $true; $ws2.Columns.Item(1).ColumnWidth = 30; $ws2.Columns.Item(2).ColumnWidth = 5; $ws2.Columns.Item(3).ColumnWidth = 50; $ws2.Columns.Item(4).ColumnWidth = 70

$ws3 = $wb.Worksheets.Add([System.Reflection.Missing]::Value, $ws2); $ws3.Name = 'Usikkert'
$ws3.Cells.Item(1,1).Value2 = 'Plante'; $ws3.Cells.Item(1,2).Value2 = 'Merknad'
$r = 2
foreach ($n in $names) { foreach ($u in @($info.$n.usikkert)) { if ($u) { $ws3.Cells.Item($r,1).Value2 = $n; $ws3.Cells.Item($r,2).Value2 = $u; $r++ } } }
$ws3.Range('A1:B1').Font.Bold = $true; $ws3.Columns.Item(1).ColumnWidth = 30; $ws3.Columns.Item(2).ColumnWidth = 110; $ws3.Columns.Item(2).WrapText = $true

$ws.Activate()
if (Test-Path $out) { Remove-Item $out -Force -Confirm:$false }
$wb.SaveAs($out, 51); $wb.Close($false); $xl.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
"Lagret $out ($($names.Count) planter)"
