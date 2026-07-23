$ErrorActionPreference = "Stop"

$sourceRoot = Join-Path $PSScriptRoot "bob-eponge\images-originales"
$outputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "outputs\bob-eponge"
$assetRoot = Join-Path $outputRoot "assets\cards"
$manifestPath = Join-Path $PSScriptRoot "bob-eponge\cards-manifest.json"

Add-Type -AssemblyName System.Drawing

$eAcute = [char]0x00E9
$eAcuteUpper = [char]0x00C9

function Get-JpegEncoder {
  [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
}

function Save-OptimizedImage {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Target
  )

  $image = [System.Drawing.Image]::FromFile($Source)
  try {
    $maxHeight = 420
    $maxWidth = 320
    $ratio = [Math]::Min($maxWidth / $image.Width, $maxHeight / $image.Height)
    if ($ratio -gt 1) { $ratio = 1 }
    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $ratio))
    $height = [Math]::Max(1, [int][Math]::Round($image.Height * $ratio))

    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }

      New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
      $quality = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 84L
      $params = New-Object System.Drawing.Imaging.EncoderParameters 1
      $params.Param[0] = $quality
      $bitmap.Save($Target, (Get-JpegEncoder), $params)
    } finally {
      if ($bitmap) { $bitmap.Dispose() }
    }

    return @{
      width = $width
      height = $height
      orientation = $(if ($width -gt $height) { "landscape" } else { "portrait" })
    }
  } finally {
    $image.Dispose()
  }
}

function Get-Slug {
  param([string]$Value)
  $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-" -replace "^-|-$", ""
}

function Get-CardGroups {
  $groups = @()
  $rarityDirs = Get-ChildItem -Directory -LiteralPath $sourceRoot
  foreach ($rarityDir in $rarityDirs) {
    $nestedDirs = Get-ChildItem -Directory -LiteralPath $rarityDir.FullName
    foreach ($nestedDir in $nestedDirs) {
      $files = Get-ChildItem -File -LiteralPath $nestedDir.FullName |
        Where-Object { $_.Extension -match "^\.(png|jpg|jpeg)$" } |
        Sort-Object CreationTimeUtc, LastWriteTimeUtc, Name
      if ($files.Count -eq 0) { continue }
      $groups += [pscustomobject]@{
        rarity = $rarityDir.Name
        setCode = $nestedDir.Name
        files = $files
        direct = $false
      }
    }

    $directFiles = Get-ChildItem -File -LiteralPath $rarityDir.FullName |
      Where-Object { $_.Extension -match "^\.(png|jpg|jpeg)$" } |
      Sort-Object CreationTimeUtc, LastWriteTimeUtc, Name
    if ($directFiles.Count -gt 0) {
      $groups += [pscustomobject]@{
        rarity = $rarityDir.Name
        setCode = $rarityDir.Name
        files = $directFiles
        direct = $true
      }
    }
  }
  $groups
}

$cards = @()
foreach ($group in Get-CardGroups) {
  $index = 1
  foreach ($file in $group.files) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    if ($group.direct -and $baseName -match "^(?<ref>[A-Za-z0-9]+-[A-Za-z0-9]+-\d{3})$") {
      $reference = $Matches.ref.ToUpperInvariant()
      $setCode = ($reference -replace "-\d{3}$", "")
    } else {
      $reference = "{0}-{1:D3}" -f $group.setCode.ToUpperInvariant(), $index
      $setCode = $group.setCode.ToUpperInvariant()
    }

    $wave = if ($setCode -match "^(SBM?\d+)") { $Matches[1].ToUpperInvariant() } else { $setCode }
    $variant = if ($setCode -match "ETOILE") { "$eAcuteUpper" + "toile" } else { "" }
    $raritySlug = Get-Slug $group.rarity
    $assetName = "$reference.jpg"
    $target = Join-Path $assetRoot (Join-Path $raritySlug $assetName)
    $dimensions = Save-OptimizedImage -Source $file.FullName -Target $target

    $cards += [ordered]@{
      id = $reference
      reference = $reference
      rarity = $group.rarity.ToUpperInvariant()
      series = $wave
      display = $setCode
      variant = $variant
      name = ""
      type = "Carte"
      source = ""
      image = "../assets/cards/$raritySlug/$assetName"
      fullImage = "../assets/cards/$raritySlug/$assetName"
      imageAlt = "Carte Bob l'" + "$eAcute" + "ponge $reference"
      imageWidth = $dimensions.width
      imageHeight = $dimensions.height
      imageOrientation = $dimensions.orientation
      originalFile = $file.FullName.Substring((Split-Path $PSScriptRoot -Parent).Length + 1)
    }

    $index += 1
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path $manifestPath -Parent) | Out-Null
$cards | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Bob cards manifest:" $cards.Count
