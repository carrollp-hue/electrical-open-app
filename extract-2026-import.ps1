param([Parameter(Mandatory = $true)][string]$Folder)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-CellValue($cell, $shared) {
  if (-not $cell) { return $null }
  $type = $cell.GetAttribute('t')
  if ($type -eq 'inlineStr') { return $cell.InnerText }
  $value = $cell.SelectSingleNode('./*[local-name()="v"]')
  if (-not $value) { return $null }
  if ($type -eq 's') { return $shared[([int]$value.InnerText)] }
  return $value.InnerText
}

function Read-Fixture($path) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($path)
  try {
    function Read-Entry([string]$name) {
      $entry = $archive.GetEntry($name); if (-not $entry) { return $null }
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try { $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    [xml]$sharedXml = Read-Entry 'xl/sharedStrings.xml'
    $shared = @($sharedXml.sst.si | ForEach-Object { $_.InnerText })
    [xml]$workbook = Read-Entry 'xl/workbook.xml'
    [xml]$relationships = Read-Entry 'xl/_rels/workbook.xml.rels'
    $ns = [System.Xml.XmlNamespaceManager]::new($workbook.NameTable)
    $ns.AddNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $sheet = $workbook.SelectSingleNode('//m:sheets/m:sheet', $ns)
    $relId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $rel = @($relationships.Relationships.Relationship | Where-Object { $_.Id -eq $relId })[0]
    $target = if ($rel.Target.StartsWith('/')) { $rel.Target.TrimStart('/') } else { "xl/$($rel.Target)" }
    [xml]$sheetXml = Read-Entry $target
    $cells = @{}
    $formulas = @{}
    foreach ($row in $sheetXml.worksheet.sheetData.row) {
      foreach ($cell in $row.c) {
        $reference = $cell.GetAttribute('r')
        if ($reference) {
          $cells[$reference] = Get-CellValue $cell $shared
          $formulaNode = $cell.SelectSingleNode('./*[local-name()="f"]')
          if ($formulaNode) { $formulas[$reference] = $formulaNode.InnerText }
        }
      }
    }
    $players = for ($row = 12; $row -le 80; $row++) {
      $surname = $cells["A$row"]; $first = $cells["B$row"]; $attend = $cells["D$row"]
      $gross = $cells["I$row"]
      if ([string]::IsNullOrWhiteSpace($surname) -or ($attend -ne 'Y' -and "$gross" -notmatch '^(NR|\d+(\.0+)?)$')) { continue }
      [pscustomobject]@{
        surname = "$surname".ToUpper(); first_name = "$first"; guest = $cells["E$row"] -eq 'Y';
        index = $cells["F$row"]; playing = $cells["H$row"]; gross = if ("$gross" -match '^\d+(\.0+)?$') { [int][double]$gross } else { $null };
        nett = if ("$($cells["J$row"])" -match '^\d+(\.0+)?$') { [int][double]$cells["J$row"] } else { $null };
        points = if ("$($cells["M$row"])" -match '^\d+(\.0+)?$') { [int][double]$cells["M$row"] } else { 0 };
        position = if ("$($cells["T$row"])" -match '^\d+(\.0+)?$') { [int][double]$cells["T$row"] } else { $null };
        oom = if ("$($cells["U$row"])" -match '^\d+(\.0+)?$') { [int][double]$cells["U$row"] } else { 0 };
        gross_formula = $formulas["I$row"];
        hole_scores = if ($formulas["I$row"] -match '^\d+(\+\d+){17}$') {
          @($formulas["I$row"].Split('+') | ForEach-Object { [int]$_ })
        } else { $null };
      }
    }
    [pscustomobject]@{
      file = [IO.Path]::GetFileName($path); course = $cells['B3']; competition = $cells['B4']; format = $cells['B6'];
      allowance = $cells['B7']; rating = $cells['X4']; slope = $cells['X5']; par = $cells['X6']; pcc = $cells['X7']; players = @($players)
    }
  } finally { $archive.Dispose() }
}

Get-ChildItem $Folder -Filter '*.xlsm' | Sort-Object Name | ForEach-Object { Read-Fixture $_.FullName } | ConvertTo-Json -Depth 6
