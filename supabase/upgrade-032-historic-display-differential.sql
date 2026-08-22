-- Stores a legacy score differential for display only. This column is never
-- read by the handicap-index functions, which continue to use score_differential.
alter table public.fixture_entries
  add column if not exists historic_display_differential numeric(8,4);

-- Dunstable Downs, CA Trophy, 9 August 2026: preserve the workbook values
-- without making any of them qualifying rounds in the app.
with source (surname, first_name, differential) as (
  values
    ('KEANE','Matt',13.0534::numeric), ('O''NEILL','Gary',23.7690::numeric),
    ('O''NEILL','Ryan',20.8466::numeric), ('HOLE','Dave',29.6138::numeric),
    ('KELLY','Paul',14.0276::numeric), ('DOOLAN','Paul',15.9759::numeric),
    ('KELLY','Brendan',33.5103::numeric), ('KEANE','Joe',38.3810::numeric),
    ('HARRISON','Nick',40.3293::numeric), ('MILES','Gary',34.4845::numeric),
    ('RAMBO','John',38.3810::numeric), ('SIMMONDS','Andy',31.5621::numeric),
    ('BAZELEY','Darryl',23.0000::numeric), ('BISSET','Alec',28.3000::numeric),
    ('CARROLL','Paul',22.5000::numeric), ('FLEMING','Dave',21.9000::numeric),
    ('NICHOLLS','Andy',34.0000::numeric), ('O''NEILL','Darren',22.7000::numeric),
    ('REEVES','Ade',15.2000::numeric)
)
update public.fixture_entries e
set historic_display_differential = source.differential
from source
join public.players p on p.surname = source.surname and p.first_name = source.first_name
where e.fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde'
  and e.player_id = p.id;

-- Safeguard: display-only values must not be copied into qualifying values.
update public.fixture_entries
set score_differential = null
where fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde';
