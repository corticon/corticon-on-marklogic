param(
  [string]$EnvFile = "..\.env",
  [string]$TemplateFile = "..\marklogic\gradle-template.properties",
  [string]$OutputFile = "..\marklogic\gradle.properties"
)

function Parse-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Env file not found: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

    if ($trimmed.StartsWith('export ')) {
      $trimmed = $trimmed.Substring(7).Trim()
    }

    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }

    $key = $trimmed.Substring(0, $eq).Trim()
    $val = $trimmed.Substring($eq + 1).Trim()

    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2)
    }

    $values[$key] = $val
  }

  return $values
}

function Resolve-Template {
  param(
    [string]$Text,
    [hashtable]$Vars
  )

  return [regex]::Replace($Text, '\$\{([A-Za-z_][A-Za-z0-9_]*)\}', {
    param($m)
    $name = $m.Groups[1].Value
    if ($Vars.ContainsKey($name)) { return $Vars[$name] }
    return $m.Value
  })
}

$envPath = Join-Path $PSScriptRoot $EnvFile
$templatePath = Join-Path $PSScriptRoot $TemplateFile
$outputPath = Join-Path $PSScriptRoot $OutputFile

$vars = Parse-EnvFile -Path $envPath
$template = Get-Content -Raw $templatePath
$resolved = Resolve-Template -Text $template -Vars $vars

Set-Content -Path $outputPath -Encoding UTF8 -Value $resolved
Write-Host "Generated $outputPath from $templatePath using $envPath"
