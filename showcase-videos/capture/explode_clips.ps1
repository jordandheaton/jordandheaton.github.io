# Explodes the Higgsfield draft-test media into frame sequences for the compositor.
$ErrorActionPreference = "Stop"
$src = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "Universe scroller\draft-test"
$out = Join-Path $env:TEMP "showcase\clips"
$jobs = @(
  @{ in = "clip1-city-to-earth.mp4";    dir = "clip1" },
  @{ in = "clip2-earth-to-moon.mp4";    dir = "clip2" },
  @{ in = "stitched-city-to-moon.mp4";  dir = "stitched" }
)
foreach ($j in $jobs) {
  $d = Join-Path $out $j.dir
  New-Item -ItemType Directory -Force $d | Out-Null
  Remove-Item (Join-Path $d "f*.jpg") -ErrorAction SilentlyContinue
  ffmpeg -v error -y -i (Join-Path $src $j.in) -start_number 0 (Join-Path $d "f%05d.jpg")
  if ($LASTEXITCODE -ne 0) { throw ("ffmpeg failed on " + $j.in) }
  Write-Host ("{0}: {1} frames" -f $j.dir, (Get-ChildItem "$d\f*.jpg").Count)
}
$anchors = Join-Path $out "anchors"
New-Item -ItemType Directory -Force $anchors | Out-Null
Copy-Item (Join-Path $src "anchor-*.png") $anchors
Write-Host ("anchors: {0}" -f (Get-ChildItem "$anchors\*.png").Count)
