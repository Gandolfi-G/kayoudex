$ErrorActionPreference = "Stop"

$pages = @(
  @{ rarity = "R"; url = "https://narutopia.fr/r-naruto-kayou" },
  @{ rarity = "SR"; url = "https://narutopia.fr/sr-naruto-kayou" },
  @{ rarity = "SSR"; url = "https://narutopia.fr/ssr-naruto-kayou" },
  @{ rarity = "TR/TGR"; url = "https://narutopia.fr/tr-tgr-naruto-kayou" },
  @{ rarity = "HR"; url = "https://narutopia.fr/hr-naruto-kayou" },
  @{ rarity = "PTR"; url = "https://narutopia.fr/cartes-ptr-naruto-kayou/" },
  @{ rarity = "UR"; url = "https://narutopia.fr/ur-naruto-kayou" },
  @{ rarity = "ZR"; url = "https://narutopia.fr/zr-naruto-kayou" },
  @{ rarity = "AR"; url = "https://narutopia.fr/ar-naruto-kayou" },
  @{ rarity = "OR"; url = "https://narutopia.fr/or-naruto-kayou" },
  @{ rarity = "SLR"; url = "https://narutopia.fr/slr-naruto-kayou" },
  @{ rarity = "CP"; url = "https://narutopia.fr/cp-naruto-kayou" },
  @{ rarity = "PU"; url = "https://narutopia.fr/cartes-pu-naruto-kayou/" },
  @{ rarity = "SP"; url = "https://narutopia.fr/sp-naruto-kayou" },
  @{ rarity = "MR"; url = "https://narutopia.fr/mr-naruto-kayou" },
  @{ rarity = "GP"; url = "https://narutopia.fr/gp-naruto-kayou" },
  @{ rarity = "CR"; url = "https://narutopia.fr/cr-naruto-kayou" },
  @{ rarity = "NR"; url = "https://narutopia.fr/nr-naruto-kayou" },
  @{ rarity = "BP"; url = "https://narutopia.fr/bp-naruto-kayou" },
  @{ rarity = "SE"; url = "https://narutopia.fr/se-naruto-kayou" },
  @{ rarity = "ASP"; url = "https://narutopia.fr/cartes-asp-naruto-kayou/" },
  @{ rarity = "SV"; url = "https://narutopia.fr/sv-naruto-kayou" },
  @{ rarity = "SCR"; url = "https://narutopia.fr/scr-naruto-kayou" },
  @{ rarity = "LR"; url = "https://narutopia.fr/lr-naruto-kayou" },
  @{ rarity = "PR"; url = "https://narutopia.fr/pr-naruto-kayou" },
  @{ rarity = "BR"; url = "https://narutopia.fr/br-naruto-kayou" }
)

function ConvertTo-PlainLines($html) {
  $blocks = [regex]::Matches($html, '(?is)<(h[1-6]|p|figcaption)[^>]*>.*?</\1>') | ForEach-Object {
    $_.Value
  }
  $text = ($blocks -join "`n") -replace '(?i)<br\s*/?>', "`n"
  $text = $text -replace '<[^>]+>', ' '
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  return ($text -split "`n" | ForEach-Object {
    ($_ -replace '\s+', ' ').Trim()
  } | Where-Object { $_ })
}

$cards = New-Object System.Collections.Generic.List[object]
$summary = New-Object System.Collections.Generic.List[object]

foreach ($page in $pages) {
  Write-Host "Fetching $($page.rarity) from $($page.url)"
  $html = (Invoke-WebRequest -Uri $page.url -UseBasicParsing).Content
  $lines = ConvertTo-PlainLines $html

  $pendingId = $null
  foreach ($line in $lines) {
    $idMatch = [regex]::Match($line, '\b[A-Z]{1,4}-\d{1,3}\b')
    $seriesMatch = [regex]::Match($line, 'S[ée]rie\s+\d+')

    if ($idMatch.Success -and $seriesMatch.Success) {
      $cards.Add([pscustomobject]@{
        id = $idMatch.Value
        rarity = $page.rarity
        series = ($seriesMatch.Value -replace 'é', 'e')
        name = ""
        type = "Carte"
        source = $page.url
      })
      $pendingId = $null
      continue
    }

    if ($idMatch.Success) {
      $pendingId = $idMatch.Value
      continue
    }

    if ($pendingId -and $seriesMatch.Success) {
      $cards.Add([pscustomobject]@{
        id = $pendingId
        rarity = $page.rarity
        series = ($seriesMatch.Value -replace 'é', 'e')
        name = ""
        type = "Carte"
        source = $page.url
      })
      $pendingId = $null
    }
  }

  $summary.Add([pscustomobject]@{
    rarity = $page.rarity
    count = ($cards | Where-Object { $_.source -eq $page.url }).Count
    url = $page.url
  })
}

$unique = $cards |
  Sort-Object rarity, id, source -Unique |
  Sort-Object @{ Expression = "rarity"; Ascending = $true }, @{ Expression = "id"; Ascending = $true }

$json = $unique | ConvertTo-Json -Depth 4
$output = "window.NARUTO_KAYOU_CARDS = $json;`n"
Set-Content -Path "outputs/naruto-kayou/data/cards.js" -Value $output -Encoding UTF8

$summary | Format-Table -AutoSize
Write-Host "Total cards: $($unique.Count)"
