# Explodes source media into frame sequences for the compositor: the original
# Higgsfield draft-test clips (older cuts still reference them) plus, as of
# Revision 7 (R16), the REAL project media from Universe scroller/media/clips
# -- draft-test is drafts (it produced the "earth teleports out" clip that had
# to stop appearing on camera); anything under media/ is the actual shipped
# project and is fair game to showcase.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$srcDraft = Join-Path $repoRoot "Universe scroller\draft-test"
$srcMedia = Join-Path $repoRoot "Universe scroller\media\clips"
$mediaRoot = Join-Path $repoRoot "Universe scroller\media"
$out = Join-Path $env:TEMP "showcase\clips"
$jobs = @(
  @{ in = "clip1-city-to-earth.mp4";    dir = "clip1";    src = $srcDraft },
  @{ in = "clip2-earth-to-moon.mp4";    dir = "clip2";    src = $srcDraft },
  @{ in = "stitched-city-to-moon.mp4";  dir = "stitched"; src = $srcDraft; vf = "scale=1920:-2:flags=lanczos,unsharp=5:5:0.4" },
  # Revision 7 (R16) generation-beat source: leaf -> treetop -> ... -> earth+moon,
  # real Higgsfield output committed to the actual project (not a draft). ffprobe
  # showed 1280x720 native, 24fps, 193 frames -- AT the "below ~1280" upscale
  # threshold, not below it, so frames are exploded at native resolution. No
  # lanczos pass: upscaling a clip that already meets the threshold spends CPU/
  # disk for a marginal sharpness gain the compositor's own canvas scaling can't
  # tell apart from the source; the stitched draft-test job above upscales
  # because ITS source was smaller than 1280 wide.
  @{ in = "leaf-treetop-to-earthmoon-720.mp4"; dir = "leafmoon"; src = $srcMedia },
  # Revision 7 (R16) grid/stitch-beat source: chosen over full-journey-leaf-to-
  # galaxy.mp4 (864x496, needs upscaling) and ASSEMBLED-leaf-to-galaxy-720.mp4
  # (1280x720 but starts at the leaf, not the chromosome) because this one covers
  # the WIDEST clean span -- chromosome all the way to the Milky Way, 1445 frames,
  # matching the live scroller's full 0..1444 frame range -- at native 1280x720,
  # same no-upscale reasoning as above.
  @{ in = "ASSEMBLED-c6-to-galaxy-720.mp4";    dir = "journey";  src = $srcMedia }
)
foreach ($j in $jobs) {
  $d = Join-Path $out $j.dir
  New-Item -ItemType Directory -Force $d | Out-Null
  Remove-Item (Join-Path $d "f*.jpg") -ErrorAction SilentlyContinue
  $ffmpegArgs = @("-v", "error", "-y", "-i", (Join-Path $j.src $j.in))
  if ($j.vf) { $ffmpegArgs += @("-vf", $j.vf) }
  $ffmpegArgs += @("-start_number", "0", (Join-Path $d "f%05d.jpg"))
  ffmpeg @ffmpegArgs
  if ($LASTEXITCODE -ne 0) { throw ("ffmpeg failed on " + $j.in) }
  Write-Host ("{0}: {1} frames" -f $j.dir, (Get-ChildItem "$d\f*.jpg").Count)
}
$anchors = Join-Path $out "anchors"
New-Item -ItemType Directory -Force $anchors | Out-Null
Copy-Item (Join-Path $srcDraft "anchor-*.png") $anchors
Write-Host ("anchors: {0}" -f (Get-ChildItem "$anchors\*.png").Count)

# Revision 7 (R16): real anchors bracketing the leafmoon clip above. a1-leaf
# (opening leaf) and a3-tree (canopy top-down at ~2s, near-pixel match to the
# clip's own treetop frame) are the primary/journey-canonical stills; b1-
# earthmoon is the closing frame -- its WIDE framing matches the clip's actual
# ending, unlike b1v2-earthmoon-centered, which zooms in far closer than the
# clip ever does. leaf-treetop.png is included as a bonus: its backlit single-
# leaf composition is an even closer match to the clip's literal frame 0 than
# a1-leaf, and its filename suggests it was the seed still this clip was
# generated from.
$anchorsReal = Join-Path $out "anchors-real"
New-Item -ItemType Directory -Force $anchorsReal | Out-Null
Copy-Item (Join-Path $mediaRoot "anchors\a1-leaf.png") $anchorsReal
Copy-Item (Join-Path $mediaRoot "anchors\a3-tree.png") $anchorsReal
Copy-Item (Join-Path $mediaRoot "anchors\leaf-treetop.png") $anchorsReal
Copy-Item (Join-Path $mediaRoot "anchors2\b1-earthmoon.png") $anchorsReal
Write-Host ("anchors-real: {0}" -f (Get-ChildItem "$anchorsReal\*.png").Count)
