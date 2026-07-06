$ErrorActionPreference = "Stop"

$remoteUrl = "git@github.com:Gandolfi-G/kayoudex.git"

$gitExecutable = Get-Command git -ErrorAction SilentlyContinue
$gitCommand = $null
if ($gitExecutable) {
  $gitCommand = $gitExecutable.Source
}
if (-not $gitCommand -and (Test-Path "C:\Program Files\Git\cmd\git.exe")) {
  $gitCommand = "C:\Program Files\Git\cmd\git.exe"
}
if (-not $gitCommand -and (Test-Path "C:\Program Files\Git\bin\git.exe")) {
  $gitCommand = "C:\Program Files\Git\bin\git.exe"
}

if (-not $gitCommand) {
  Write-Host "Git n'est pas disponible dans ce terminal."
  Write-Host "Installe Git pour Windows, puis relance ce script depuis la racine du projet."
  exit 1
}

if (-not (Test-Path ".git/config")) {
  & $gitCommand init
}

$remotes = & $gitCommand remote
if ($remotes -contains "origin") {
  & $gitCommand remote set-url origin $remoteUrl
} else {
  & $gitCommand remote add origin $remoteUrl
}

& $gitCommand add .
& $gitCommand commit -m "Initial Naruto Kayou checklist site"
& $gitCommand branch -M main
& $gitCommand push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Le push a echoue. Verifie l'acces SSH GitHub puis relance le script."
  exit $LASTEXITCODE
}

Write-Host "Depot pousse sur $remoteUrl"
