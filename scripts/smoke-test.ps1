param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminUser = "admin",
  [string]$AdminPass = "change-me",
  [string]$TestUrl = "https://www.google.com"
)

$ErrorActionPreference = "Stop"

Write-Host "Running smoke test against $BaseUrl"

$pair = "${AdminUser}:${AdminPass}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$token = [Convert]::ToBase64String($bytes)
$headers = @{
  Authorization = "Basic $token"
  "Content-Type" = "application/json"
}

$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/healthz"
if ($health -ne "ok") {
  throw "Health check failed. Expected 'ok' got '$health'"
}
Write-Host "Health check OK"

$payload = @{ url = $TestUrl } | ConvertTo-Json -Compress
$shorten = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/shorten" -Headers $headers -Body $payload
if (-not $shorten.slug) {
  throw "Shorten response missing slug."
}
Write-Host "Shorten OK: $($shorten.short_url)"

& curl.exe -I --max-time 10 "$BaseUrl/$($shorten.slug)" | Out-File -FilePath "$env:TEMP\shortener-redirect-check.txt" -Encoding ascii
$headersText = Get-Content "$env:TEMP\shortener-redirect-check.txt" -Raw
if ($headersText -notmatch "HTTP\/1\.[01]\s+302") {
  throw "Redirect test failed. Expected HTTP 302."
}
Write-Host "Redirect OK (302)"

$stats = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/stats/$($shorten.slug)"
if ($stats.clicks -lt 1) {
  throw "Stats test failed. Clicks should be >= 1."
}
Write-Host "Stats OK: clicks=$($stats.clicks)"

Write-Host "Smoke test completed successfully."
