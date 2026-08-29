param(
  [string]$Folder = 'C:\Users\carro\OneDrive\Electrical Open\Completed Fixtures\2026',
  [string]$OutputPath = "$PSScriptRoot\import-2026-historical-scorecards.sql"
)

$cards = @{
  '20260329_Stockwood_Park.xlsm'      = @{ tee='Yellow (historic)'; par=@(4,5,4,3,4,4,4,3,4,3,5,3,4,3,4,4,4,4); si=@(9,7,3,13,1,5,17,11,15,4,12,16,6,14,18,8,2,10) }
  '20260419_Little_Hay.xlsm'          = @{ tee='Yellow'; par=@(5,4,4,3,4,4,4,3,5,4,4,5,4,3,4,3,5,4); si=@(7,5,1,11,14,10,3,17,15,12,6,8,16,18,2,4,13,9) }
  '20260614_Colmworth_Golf_Club.xlsm' = @{ tee='Yellow'; par=@(4,4,4,4,3,5,4,4,3,5,3,5,4,4,4,4,3,5); si=@(12,4,6,10,16,8,2,14,18,5,9,3,15,1,17,11,13,7) }
  '20260628_Stevenage_Golf_Club.xlsm' = @{ tee='Yellow'; par=@(5,3,4,3,5,5,4,4,4,3,4,5,4,3,4,4,3,4); si=@(13,15,9,4,8,18,2,12,6,16,10,14,1,11,17,7,3,5) }
  '20260705_Millgreen_Golf_Club.xlsm' = @{ tee='White'; par=@(5,3,4,4,5,3,5,4,3,5,4,4,4,3,4,4,4,4); si=@(12,4,2,8,16,18,6,10,14,7,17,3,15,9,1,13,5,11) }
  '20260715_Chartridge_Park.xlsm'     = @{ tee='Yellow'; par=@(4,4,5,3,4,3,4,3,4,3,4,4,3,5,3,4,4,4); si=@(6,2,10,18,8,12,4,14,16,11,1,5,15,13,7,3,17,9) }
  '20260802_Oakland_Park.xlsm'        = @{ tee='Yellow'; par=@(4,4,3,5,3,3,4,3,4,4,3,3,4,3,4,4,5,4); si=@(7,5,14,2,18,16,9,10,6,3,12,15,8,17,13,1,4,11) }
}

function SqlText([string]$value) { return "'" + $value.Replace("'", "''") + "'" }

$fixtures = & "$PSScriptRoot\extract-2026-import.ps1" $Folder | ConvertFrom-Json | Where-Object {$cards.ContainsKey($_.file)}
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('-- Adds full course cards and workbook hole-by-hole scores to the seven 2026 display-only historic fixtures.')
$lines.Add('-- Historic fixture totals, score differentials and Order of Merit data are not recalculated or changed.')
$lines.Add('begin;')

foreach ($fixture in $fixtures) {
  $card = $cards[$fixture.file]
  $date = [regex]::Match($fixture.file, '^\d{8}').Value
  $isoDate = "$($date.Substring(0,4))-$($date.Substring(4,2))-$($date.Substring(6,2))"
  $course = SqlText "$($fixture.course)"
  $lines.Add("do `$`$")
  $lines.Add('declare v_setup uuid; v_fixture uuid; begin')
  $lines.Add("  select f.course_setup_id, f.id into v_setup, v_fixture from public.fixtures f where f.is_historical = true and f.fixture_date = date '$isoDate' and f.name = $course limit 1;")
  $lines.Add("  if v_fixture is null or v_setup is null then raise exception 'Historic fixture missing: $isoDate $($fixture.course)'; end if;")
  $lines.Add("  update public.course_setups set tee_name = $(SqlText $card.tee), par = $([int](($card.par | Measure-Object -Sum).Sum)) where id = v_setup;")
  foreach ($i in 0..17) {
    $lines.Add("  insert into public.course_holes (course_setup_id, hole_number, par, stroke_index) values (v_setup,$($i+1),$($card.par[$i]),$($card.si[$i])) on conflict (course_setup_id,hole_number) do update set par = excluded.par, stroke_index = excluded.stroke_index;")
  }
  $lines.Add('  delete from public.hole_scores h using public.fixture_entries e where h.fixture_entry_id = e.id and e.fixture_id = v_fixture;')
  $playersWithScores = @($fixture.players | Where-Object {$_.hole_scores})
  # The Stockwood workbook total for Carl Harrison is 96 but its saved formula
  # omitted hole 18. The confirmed final-hole score is six.
  if ($fixture.file -eq '20260329_Stockwood_Park.xlsm') {
    $playersWithScores += [pscustomobject]@{
      surname = 'HARRISON'
      first_name = 'Carl'
      hole_scores = @(7,6,5,6,6,4,5,6,5,7,4,6,5,6,6,6,6,6)
    }
  }
  $scoreValues = [System.Collections.Generic.List[string]]::new()
  foreach ($player in $playersWithScores) {
    $scores = @($player.hole_scores)
    if ($scores.Count -ne 18) { continue }
    $scoreValues.Add("($(SqlText $player.surname),$(SqlText $player.first_name),$(SqlText ($scores -join ',')))")
  }
  $lines.Add("  insert into public.hole_scores (fixture_entry_id,hole_number,gross_score,handicap_strokes,nett_score,stableford_points) select e.id,s.hole_number,s.gross_score,x.strokes,s.gross_score-x.strokes,greatest(0,2+ch.par-(s.gross_score-x.strokes)) from (values $($scoreValues -join ',')) as v(surname,first_name,scores) cross join lateral unnest(string_to_array(v.scores, ',')::integer[]) with ordinality as s(gross_score,hole_number) join public.players p on p.surname=v.surname and p.first_name=v.first_name join public.fixture_entries e on e.player_id=p.id and e.fixture_id=v_fixture join public.course_holes ch on ch.course_setup_id=v_setup and ch.hole_number=s.hole_number cross join lateral (select greatest(0,floor(greatest(0,e.playing_handicap)::numeric/18)::integer + case when ch.stroke_index <= mod(greatest(0,e.playing_handicap),18) then 1 else 0 end) as strokes) x on conflict (fixture_entry_id,hole_number) do update set gross_score=excluded.gross_score,handicap_strokes=excluded.handicap_strokes,nett_score=excluded.nett_score,stableford_points=excluded.stableford_points;")
  $lines.Add('  update public.fixture_entries set score_differential = null where fixture_id = v_fixture;')
  $lines.Add('end $$;')
}
$lines.Add('commit;')
$lines.Add("select count(*) as historical_hole_scores from public.hole_scores h join public.fixture_entries e on e.id=h.fixture_entry_id join public.fixtures f on f.id=e.fixture_id where f.is_historical = true and f.fixture_date between date '2026-03-29' and date '2026-08-02';")

[System.IO.File]::WriteAllLines($OutputPath, $lines)
Write-Output "Created $OutputPath with $($lines.Count) SQL statements."

# Supabase's browser editor has a query-size ceiling, so also produce smaller
# transactions (up to eight scorecards each). Each fragment is independently
# safe to run and only the first fragment for a fixture resets its old cards.
$allSql = [System.IO.File]::ReadAllText($OutputPath)
$fixtureBlocks = [regex]::Matches($allSql, '(?s)do \$\$.*?end \$\$;')
$partNumber = 0
foreach ($fixtureBlock in $fixtureBlocks) {
  $blockLines = @($fixtureBlock.Value -split "`r?`n")
  $scoreIndexes = @($blockLines | ForEach-Object -Begin { $index = 0 } -Process { if ($_ -like '  insert into public.hole_scores*') { $index }; $index++ })
  $firstScoreIndex = $scoreIndexes[0]
  $lastScoreIndex = $scoreIndexes[-1]
  $bootstrap = @($blockLines[0..3])
  $firstPreamble = @($blockLines[0..($firstScoreIndex - 1)])
  $postamble = @($blockLines[($lastScoreIndex + 1)..($blockLines.Count - 1)])
  for ($offset = 0; $offset -lt $scoreIndexes.Count; $offset += 144) {
    $partNumber++
    $take = [Math]::Min(144, $scoreIndexes.Count - $offset)
    $scoreLines = @($blockLines[$scoreIndexes[$offset..($offset + $take - 1)]])
    $preamble = if ($offset -eq 0) { $firstPreamble } else { $bootstrap }
    $chunkPath = Join-Path $PSScriptRoot ("import-2026-historical-scorecards-part-{0:D2}.sql" -f $partNumber)
    $chunk = "-- Historic scorecard import part $partNumber.`r`nbegin;`r`n" + (($preamble + $scoreLines + $postamble) -join "`r`n") + "`r`ncommit;`r`n"
    [System.IO.File]::WriteAllText($chunkPath, $chunk)
  }
}
Get-ChildItem -Path $PSScriptRoot -Filter 'import-2026-historical-scorecards-part-*.sql' | Where-Object { $_.Name -match 'part-(\d+)\.sql' -and [int]$Matches[1] -gt $partNumber } | Remove-Item -Force
Write-Output "Created $partNumber Supabase editor-sized import parts."
