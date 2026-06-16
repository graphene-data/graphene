---
title: Team Season Lab
layout: dashboard
---

```sql team_games
select *
from team_game
where season_type = 'Regular Season'
  and season >= 2004
  and fga is not null
```

```sql team_options
select team
from team_games
group by team
order by team
```

```sql season_options
select season
from team_games
group by season
order by season desc
```

<Row>
  <Dropdown title="Team" name="selected_team" data="team_options" value="team" defaultValue="Denver Nuggets" />
  <Dropdown title="Season" name="selected_season" data="season_options" value="season" defaultValue="2022" />
</Row>

```sql league_team_totals
select
  season,
  team,
  count(*) as games,
  sum(case when wl = 'W' then 1 else 0 end) as wins,
  sum(case when wl = 'L' then 1 else 0 end) as losses,
  sum(for_points) as total_for_points,
  sum(against_points) as total_against_points,
  sum(fgm) as total_fgm,
  sum(fga) as total_fga,
  sum(fg3m) as total_fg3m,
  sum(fg3a) as total_fg3a,
  sum(fta) as total_fta,
  sum(oreb) as total_oreb,
  sum(opp_dreb) as total_opp_dreb,
  sum(tov) as total_tov,
  sum(ast) as total_ast,
  sum(reb) as total_reb
from team_games
group by season, team
having count(*) >= 60
```

```sql league_team_seasons
select
  season,
  team,
  games,
  wins,
  losses,
  wins / games * 100 as win_pct,
  total_for_points / games as for_points,
  total_against_points / games as against_points,
  (total_for_points - total_against_points) / games as net_points,
  (total_fgm + 0.5 * total_fg3m) / nullif(total_fga, 0) * 100 as efg_pct,
  total_tov / nullif(total_fga + 0.44 * total_fta + total_tov, 0) * 100 as tov_pct,
  total_oreb / nullif(total_oreb + total_opp_dreb, 0) * 100 as orb_pct,
  total_fta / nullif(total_fga, 0) * 100 as free_throw_rate,
  total_fg3a / nullif(total_fga, 0) * 100 as three_point_rate,
  total_ast / games as assists,
  total_tov / games as turnovers,
  total_reb / games as rebounds
from league_team_totals
```

```sql selected_team_season
select
  season,
  team,
  games,
  wins,
  losses,
  round(win_pct, 1) as win_pct,
  round(for_points, 1) as for_points,
  round(against_points, 1) as against_points,
  round(net_points, 1) as net_points,
  round(efg_pct, 1) as efg_pct,
  round(tov_pct, 1) as tov_pct,
  round(orb_pct, 1) as orb_pct,
  round(free_throw_rate, 1) as free_throw_rate,
  round(three_point_rate, 1) as three_point_rate,
  round(assists, 1) as assists,
  round(turnovers, 1) as turnovers,
  round(rebounds, 1) as rebounds
from league_team_seasons
where team = $selected_team
  and season = cast($selected_season as int64)
```

```sql league_context
select
  season,
  team,
  case when team = $selected_team then 'Selected team' else 'League' end as team_group,
  round(win_pct, 1) as win_pct,
  round(net_points, 1) as net_points,
  round(efg_pct, 1) as efg_pct,
  round(tov_pct, 1) as tov_pct,
  round(orb_pct, 1) as orb_pct,
  round(free_throw_rate, 1) as free_throw_rate,
  round(three_point_rate, 1) as three_point_rate
from league_team_seasons
where season = cast($selected_season as int64)
```

```sql league_averages
select
  round(avg(win_pct), 1) as win_pct,
  round(avg(net_points), 1) as net_points,
  round(avg(efg_pct), 1) as efg_pct,
  round(avg(tov_pct), 1) as tov_pct,
  round(avg(orb_pct), 1) as orb_pct,
  round(avg(free_throw_rate), 1) as free_throw_rate,
  round(avg(three_point_rate), 1) as three_point_rate
from league_team_seasons
where season = cast($selected_season as int64)
```

<Row>
  <BigValue title="Wins" data="selected_team_season" value="wins" />
  <BigValue title="Losses" data="selected_team_season" value="losses" />
  <BigValue title="Win %" data="selected_team_season" value="win_pct" />
  <BigValue title="Point Diff/G" data="selected_team_season" value="net_points" />
</Row>

<Row>
  <ScatterPlot title="Record vs scoring margin" data="league_context" x="net_points" y="win_pct" splitBy="team_group" height="360px" />
  <ScatterPlot title="Shot profile: threes vs free throws" data="league_context" x="three_point_rate" y="free_throw_rate" splitBy="team_group" height="360px" />
</Row>

```sql four_factors
with comparison as (
  select
    selected_team_season.efg_pct as selected_efg_pct,
    selected_team_season.tov_pct as selected_tov_pct,
    selected_team_season.orb_pct as selected_orb_pct,
    selected_team_season.free_throw_rate as selected_free_throw_rate,
    selected_team_season.three_point_rate as selected_three_point_rate,
    league_averages.efg_pct as league_efg_pct,
    league_averages.tov_pct as league_tov_pct,
    league_averages.orb_pct as league_orb_pct,
    league_averages.free_throw_rate as league_free_throw_rate,
    league_averages.three_point_rate as league_three_point_rate
  from selected_team_season
  cross join league_averages
)
select 'eFG%' as metric, selected_efg_pct as selected_value, league_efg_pct as league_average
from comparison
union all
select 'TOV%' as metric, selected_tov_pct as selected_value, league_tov_pct as league_average
from comparison
union all
select 'ORB%' as metric, selected_orb_pct as selected_value, league_orb_pct as league_average
from comparison
union all
select 'FT Rate' as metric, selected_free_throw_rate as selected_value, league_free_throw_rate as league_average
from comparison
union all
select '3P Rate' as metric, selected_three_point_rate as selected_value, league_three_point_rate as league_average
from comparison
```

<BarChart title="Style and four-factor profile vs league average" data="four_factors" x="metric" y="selected_value, league_average" arrange="group" label height="380px" />

```sql game_log
select
  row_number() over (order by game_date) as game_number,
  game_date,
  opponent,
  location,
  wl,
  for_points,
  against_points,
  for_points - against_points as margin,
  sum(for_points - against_points) over (order by game_date) as cumulative_margin,
  round(fg3a / nullif(fga, 0) * 100, 1) as three_point_rate,
  round((fgm + 0.5 * fg3m) / nullif(fga, 0) * 100, 1) as efg_pct,
  ast,
  tov,
  reb
from team_games
where team = $selected_team
  and season = cast($selected_season as int64)
order by game_date
```

<Row>
  <LineChart title="Cumulative scoring margin" data="game_log" x="game_number" y="cumulative_margin" height="340px" />
  <ScatterPlot title="Game-level shot quality and margin" data="game_log" x="efg_pct" y="margin" splitBy="location" height="340px" />
</Row>

```sql home_away_totals
select
  location,
  count(*) as games,
  sum(case when wl = 'W' then 1 else 0 end) as wins,
  sum(for_points) as total_for_points,
  sum(against_points) as total_against_points,
  sum(three_point_rate) as total_three_point_rate,
  sum(efg_pct) as total_efg_pct
from game_log
group by location
```

```sql home_away_split
select
  location,
  games,
  wins,
  round(wins / games * 100, 1) as win_pct,
  round(total_for_points / games, 1) as for_points,
  round(total_against_points / games, 1) as against_points,
  round((total_for_points - total_against_points) / games, 1) as net_points,
  round(total_three_point_rate / games, 1) as three_point_rate,
  round(total_efg_pct / games, 1) as efg_pct
from home_away_totals
order by location desc
```

<Row>
  <BarChart title="Home/away win rate" data="home_away_split" x="location" y="win_pct" label height="300px" />
  <BarChart title="Home/away scoring margin" data="home_away_split" x="location" y="net_points" label height="300px" />
</Row>

<Table title="Game log" data="game_log" sortable rows=15 compact>
  <Column id="game_date" title="Date" />
  <Column id="location" title="Loc" />
  <Column id="opponent" title="Opponent" />
  <Column id="wl" title="W/L" />
  <Column id="for_points" title="PF" align="right" />
  <Column id="against_points" title="PA" align="right" />
  <Column id="margin" title="Margin" align="right" />
  <Column id="three_point_rate" title="3P Rate" align="right" />
  <Column id="efg_pct" title="eFG%" align="right" />
  <Column id="ast" title="AST" align="right" />
  <Column id="tov" title="TOV" align="right" />
  <Column id="reb" title="REB" align="right" />
</Table>
