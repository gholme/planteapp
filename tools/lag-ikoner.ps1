# Lager app-ikoner (PNG) i www/icons med System.Drawing.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'www\icons'
New-Item -ItemType Directory -Force $dir | Out-Null

function New-Icon([int]$size, [string]$file, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 47, 107, 61))
  if ($rounded) {
    $r = [int]($size * 0.22); $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2*$r, 2*$r, 180, 90); $p.AddArc($size-2*$r-1, 0, 2*$r, 2*$r, 270, 90)
    $p.AddArc($size-2*$r-1, $size-2*$r-1, 2*$r, 2*$r, 0, 90); $p.AddArc(0, $size-2*$r-1, 2*$r, 2*$r, 90, 90)
    $p.CloseFigure(); $g.FillPath($bg, $p)
  } else { $g.FillRectangle($bg, 0, 0, $size, $size) }

  # Blad: to buer mellom spiss og stilk, rotert 45 grader, innenfor trygg sone (60 %).
  $s = $size / 100.0
  $g.TranslateTransform(50*$s, 50*$s); $g.RotateTransform(-45)
  $leaf = New-Object System.Drawing.Drawing2D.GraphicsPath
  $leaf.AddBezier([single](-28*$s), 0, [single](-12*$s), [single](-22*$s), [single](12*$s), [single](-22*$s), [single](28*$s), 0)
  $leaf.AddBezier([single](28*$s), 0, [single](12*$s), [single](22*$s), [single](-12*$s), [single](22*$s), [single](-28*$s), 0)
  $leaf.CloseFigure()
  $light = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 214, 240, 200))
  $g.FillPath($light, $leaf)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 47, 107, 61)), ([single](2.6*$s))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, [single](-24*$s), 0, [single](22*$s), 0)
  foreach ($x in -14, -3, 8) {
    $g.DrawLine($pen, [single]($x*$s), 0, [single](($x+6)*$s), [single](-8*$s))
    $g.DrawLine($pen, [single]($x*$s), 0, [single](($x+6)*$s), [single](8*$s))
  }
  $stem = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 214, 240, 200)), ([single](3.4*$s))
  $stem.StartCap = 'Round'; $stem.EndCap = 'Round'
  $g.DrawLine($stem, [single](-27*$s), 0, [single](-36*$s), 0)
  $g.Dispose()
  $bmp.Save((Join-Path $dir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
New-Icon 192 'icon-192.png' $true
New-Icon 512 'icon-512.png' $true
New-Icon 512 'maskable-512.png' $false
New-Icon 180 'apple-touch-icon.png' $false
New-Icon 64 'favicon-64.png' $true
Get-ChildItem $dir | ForEach-Object { "$($_.Name) $($_.Length)" }
