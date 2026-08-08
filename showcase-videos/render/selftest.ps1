# Runs a compose selftest page headlessly and reports pass/fail.
#   .\selftest.ps1                      # compose/selftest.html
#   .\selftest.ps1 -Page other.html
[CmdletBinding()] param([string] $Page = "selftest.html", [int] $TimeoutSec = 60)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$compose = Join-Path (Split-Path -Parent $here) "compose"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$urlPath = ((Join-Path $compose $Page) -replace '\\', '/') -replace ' ', '%20'
$url = "file:///" + $urlPath + "?emit"
$profileDir = Join-Path $env:TEMP ("showcase-selftest-" + [guid]::NewGuid().ToString("N"))
$dump = [System.IO.Path]::GetTempFileName()
$err = [System.IO.Path]::GetTempFileName()
try {
  $args = @("--headless=new", "--disable-gpu", "--no-first-run", "--allow-file-access-from-files",
            "--user-data-dir=$profileDir", "--virtual-time-budget=$($TimeoutSec * 1000)",
            "--dump-dom", $url)
  $p = Start-Process -FilePath $chrome -ArgumentList $args -NoNewWindow -PassThru `
        -RedirectStandardOutput $dump -RedirectStandardError $err
  if (-not $p.WaitForExit($TimeoutSec * 1000)) { $p.Kill(); throw "timed out" }
  $html = Get-Content $dump -Raw -Encoding UTF8
  if (-not ($html -match '(?s)<pre id="emit"[^>]*>(.*?)</pre>')) { throw "no emit payload" }
  $r = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1].Trim())) | ConvertFrom-Json
  foreach ($c in $r.checks) {
    $col = if ($c.ok) { "Green" } else { "Red" }
    Write-Host ("  {0}  {1}  {2}" -f ($(if ($c.ok) {"PASS"} else {"FAIL"})), $c.name, $c.detail) -ForegroundColor $col
  }
  Write-Host ("{0} passed, {1} failed" -f $r.pass, $r.fail)
  if ($r.fail -eq 0) { exit 0 } else { exit 1 }
} finally {
  Remove-Item $dump, $err -ErrorAction SilentlyContinue
  Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
