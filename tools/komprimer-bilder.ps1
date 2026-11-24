# Komprimerer bildene i www/img: maks 480 px bredde, JPEG kvalitet 78.
param([int]$Maks = 480, [int]$Kvalitet = 78)
Add-Type -AssemblyName System.Drawing
$dir = Join-Path (Split-Path -Parent $PSScriptRoot) 'www\img'
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Kvalitet)
$before = 0; $after = 0
foreach ($f in Get-ChildItem $dir -Filter *.jpg) {
  $before += $f.Length
  $im = [System.Drawing.Image]::FromFile($f.FullName)
  $w = [Math]::Min($Maks, $im.Width); $h = [int]($im.Height * $w / $im.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($im, 0, 0, $w, $h); $g.Dispose(); $im.Dispose()
  $tmp = "$($f.FullName).tmp"
  $bmp.Save($tmp, $codec, $ep); $bmp.Dispose()
  if ((Get-Item $tmp).Length -lt $f.Length) { Move-Item $tmp $f.FullName -Force } else { Remove-Item $tmp }
  $after += (Get-Item $f.FullName).Length
}
"{0:N1} MB -> {1:N1} MB" -f ($before / 1MB), ($after / 1MB)
