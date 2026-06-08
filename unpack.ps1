$htmlPath = "NEX EMS Redesign (Standalone).html"
$outputDir = "unpacked"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Reading HTML file..."
$content = [System.IO.File]::ReadAllText((Resolve-Path $htmlPath).Path)

# Extract manifest JSON
if ($content -match '<script type="__bundler/manifest">(.*?)</script>') {
    $manifestRaw = $Matches[1].Trim()
    $manifest = ConvertFrom-Json $manifestRaw
} else {
    Write-Error "Could not find manifest!"
    exit 1
}

# Extract template JSON string
if ($content -match '<script type="__bundler/template">(.*?)</script>') {
    $templateRaw = $Matches[1].Trim()
    $templateStr = ConvertFrom-Json $templateRaw
} else {
    Write-Error "Could not find template!"
    exit 1
}

Write-Host "Unpacking assets..."
foreach ($property in $manifest.PSObject.Properties) {
    $uuid = $property.Name
    $entry = $property.Value
    
    $base64 = $entry.data
    $bytes = [System.Convert]::FromBase64String($base64)
    
    if ($entry.compressed) {
        $ms = [System.IO.MemoryStream]::new($bytes)
        $gs = [System.IO.Compression.GZipStream]::new($ms, [System.IO.Compression.CompressionMode]::Decompress)
        $outMs = [System.IO.MemoryStream]::new()
        $gs.CopyTo($outMs)
        $uncompressedBytes = $outMs.ToArray()
        $gs.Dispose()
        $ms.Dispose()
        $outMs.Dispose()
    } else {
        $uncompressedBytes = $bytes
    }
    
    # Determine extension
    $mime = $entry.mime
    $ext = "bin"
    if ($mime -like "*javascript*" -or $mime -like "*json*") { $ext = "js" }
    elseif ($mime -like "*css*") { $ext = "css" }
    elseif ($mime -like "*html*") { $ext = "html" }
    elseif ($mime -like "*png*") { $ext = "png" }
    elseif ($mime -like "*svg*") { $ext = "svg" }
    elseif ($mime -like "*woff2*") { $ext = "woff2" }
    
    $filename = "$uuid.$ext"
    $filepath = Join-Path $outputDir $filename
    
    [System.IO.File]::WriteAllBytes($filepath, $uncompressedBytes)
    Write-Host "Saved $filename ($( $uncompressedBytes.Length ) bytes)"
}

$templatePath = Join-Path $outputDir "template.html"
[System.IO.File]::WriteAllText($templatePath, $templateStr)
Write-Host "Saved template.html"

# Save metadata.json
$metadata = @{
    ext_resources = @()
    manifest_info = @{}
}
foreach ($property in $manifest.PSObject.Properties) {
    $metadata.manifest_info[$property.Name] = @{
        mime = $property.Value.mime
        compressed = [bool]$property.Value.compressed
    }
}
$metadataPath = Join-Path $outputDir "metadata.json"
$metadataJson = ConvertTo-Json $metadata -Depth 10
[System.IO.File]::WriteAllText($metadataPath, $metadataJson)
Write-Host "Saved metadata.json"

Write-Host "Unpacking complete!"
