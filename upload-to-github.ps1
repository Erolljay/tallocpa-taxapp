# ============================================================
# Tallo CPA – Upload tallocpa-taxapp to GitHub
# Run this in PowerShell — no Git or installs needed
# ============================================================

# ── EDIT THESE TWO LINES ─────────────────────────────────────
$TOKEN = "PASTE_YOUR_TOKEN_HERE"   # ghp_xxxxxxxxxxxx
$REPO  = "erolljay/tallocpa-taxapp"
# ─────────────────────────────────────────────────────────────

$FILES = @(
    "index.html",
    "app.js",
    "setup.js",
    "vat.js",
    "sls-slp.js",
    "atc-codes.js",
    "styles.css",
    "installer.html"
)

$FOLDER = Split-Path -Parent $MyInvocation.MyCommand.Path
$HEADERS = @{
    Authorization = "token $TOKEN"
    Accept        = "application/vnd.github+json"
    "User-Agent"  = "TalloCPA-Uploader"
}

Write-Host "`n🚀 Starting upload to github.com/$REPO`n" -ForegroundColor Cyan

foreach ($file in $FILES) {
    $path    = Join-Path $FOLDER $file
    $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
    $apiUrl  = "https://api.github.com/repos/$REPO/contents/$file"

    # Check if file already exists (need its SHA to update)
    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri $apiUrl -Headers $HEADERS -Method GET -ErrorAction Stop
        $sha = $existing.sha
    } catch {}

    $body = @{ message = "Upload $file"; content = $content }
    if ($sha) { $body.sha = $sha }

    try {
        Invoke-RestMethod -Uri $apiUrl -Headers $HEADERS -Method PUT `
            -Body ($body | ConvertTo-Json -Depth 3) -ContentType "application/json" | Out-Null
        Write-Host "  ✅ $file" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ $file — $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Done! Visit: https://erolljay.github.io/tallocpa-taxapp/" -ForegroundColor Cyan
Write-Host "   (Enable Pages in repo Settings → Pages → main branch if not yet done)`n"
