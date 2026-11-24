# Lager et kontaktark (rutenett) av alle plantebildene for rask visuell kontroll.
param([string]$Ut = "$env:TEMP\planter-kontaktark", [int]$PerArk = 42)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$planter = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\planter.json') | ConvertFrom-Json
$bilder = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\bilder.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force $Ut | Out-Null
$cols = 7; $cell = 150; $lab = 34
$font = New-Object System.Drawing.Font 'Segoe UI', 8
$items = @(); $n = 0
foreach ($p in $planter) { $n++; $items += [pscustomobject]@{ n = $n; p = $p; b = $bilder.($p.latin) } }
$sheet = 0
for ($start = 0; $start -lt $items.Count; $start += $PerArk) {
  $sheet++
  $chunk = $items[$start..([Math]::Min($start + $PerArk, $items.Count) - 1)]
  $rows = [Math]::Ceiling($chunk.Count / $cols)
  $bmp = New-Object System.Drawing.Bitmap ($cols * $cell), ($rows * ($cell + $lab))
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White)
  $k = 0
  foreach ($it in $chunk) {
    $x = ($k % $cols) * $cell; $y = [Math]::Floor($k / $cols) * ($cell + $lab)
    if ($it.b) {
      $f = Join-Path $root ('www\' + $it.b.fil)
      try {
        $im = [System.Drawing.Image]::FromFile($f)
        $s = [Math]::Min($im.Width, $im.Height)
        $src = New-Object System.Drawing.Rectangle ([int](($im.Width - $s) / 2)), ([int](($im.Height - $s) / 2)), $s, $s
        $g.DrawImage($im, (New-Object System.Drawing.Rectangle ($x + 2), ($y + 2), ($cell - 4), ($cell - 4)), $src, 'Pixel')
        $im.Dispose()
      } catch {}
    } else { $g.FillRectangle([System.Drawing.Brushes]::MistyRose, $x + 2, $y + 2, $cell - 4, $cell - 4) }
    $txt = "$($it.n). $($it.p.latin)`n$($it.p.norsk)"
    $g.DrawString($txt, $font, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF ($x + 2), ($y + $cell), ($cell - 4), $lab))
    $k++
  }
  $g.Dispose()
  $path = Join-Path $Ut "ark$sheet.jpg"; $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()
  $path
}
