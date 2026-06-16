---
title: NBA Stats
layout: dashboard
---

This example explores NBA data from 2004-2022. Be sure to check out the sidebar for more page.

```sql team_seasons
select
  season,
  cast(season as string) as season_label,
  team,
  count(*) as games,
  sum(case when wl = 'W' then 1 else 0 end) as wins,
  sum(case when wl = 'L' then 1 else 0 end) as losses,
  round(sum(case when wl = 'W' then 1 else 0 end) / count(*) * 100, 1) as win_pct, #pct
  round((sum(for_points) - sum(against_points)) / count(*), 1) as net_points,
  round(sum(for_points) / count(*), 1) as for_points,
  round(sum(against_points) / count(*), 1) as against_points,
  round((sum(fgm) + 0.5 * sum(fg3m)) / nullif(sum(fga), 0) * 100, 1) as efg_pct, #pct
  round(sum(fg3a) / nullif(sum(fga), 0) * 100, 1) as three_point_rate, #pct
  round(sum(fta) / nullif(sum(fga), 0) * 100, 1) as free_throw_rate, #pct
  round(sum(tov) / nullif(sum(fga) + 0.44 * sum(fta) + sum(tov), 0) * 100, 1) as tov_pct, #pct
  round(sum(oreb) / nullif(sum(oreb) + sum(opp_dreb), 0) * 100, 1) as orb_pct, #pct
  round(sum(ast) / count(*), 1) as assists,
  round(sum(reb) / count(*), 1) as rebounds,
  '/team-season-lab?selected_team=' || replace(team, ' ', '%20') || '&selected_season=' || cast(season as string) as lab_link
from team_game
where season_type = 'Regular Season'
  and season >= 2004
  and fga is not null
group by season, team
having count(*) >= 60
order by season, team
```

<ECharts data="team_seasons" height=620px>
  title: {text: "Team win percentage by season"},
  tooltip: {trigger: 'item'},
  grid: {top: 20},
  visualMap: {min: 0, max: 100, dimension: 'win_pct', calculable: true, orient: 'horizontal', left: 'center', bottom: 15, inRange: {color: ['#b4464b', '#f3efe7', '#2f7f6f']}},
  xAxis: {type: 'category', position: 'top', axisLabel: {interval: 0, rotate: 45}},
  yAxis: {type: 'category', inverse: true, axisLabel: {interval: 0, fontSize: 11}},
  series: [{type: 'heatmap', encode: {x: 'season', y: 'team', value: 'win_pct', sort: 'season asc'}, label: {show: false}}],
</ECharts>

<Table title="Team seasons" data="team_seasons" sortable rows=20 compact link="lab_link" sort="win_pct desc">
  <Column id="season" title="Season" />
  <Column id="team" title="Team" />
  <Column id="wins" title="W" align="right" />
  <Column id="losses" title="L" align="right" />
  <Column id="win_pct" title="Win %" align="right" />
  <Column id="net_points" title="Net/G" align="right" />
  <Column id="for_points" title="PF/G" align="right" />
  <Column id="against_points" title="PA/G" align="right" />
  <Column id="efg_pct" title="eFG%" align="right" />
  <Column id="three_point_rate" title="3P Rate" align="right" />
  <Column id="free_throw_rate" title="FT Rate" align="right" />
  <Column id="tov_pct" title="TOV%" align="right" />
  <Column id="orb_pct" title="ORB%" align="right" />
  <Column id="assists" title="AST/G" align="right" />
  <Column id="rebounds" title="REB/G" align="right" />
</Table>

```sql standings_spread
select
  season,
  max(win_pct) as best_win_pct,
  round(avg(win_pct), 1) as avg_win_pct,
  min(win_pct) as worst_win_pct
from team_seasons
group by season
order by season
```

```sql separated_teams
select
  season,
  sum(case when win_pct >= 60 then 1 else 0 end) as sixty_win_pct_teams,
  sum(case when win_pct <= 40 then 1 else 0 end) as forty_win_pct_teams
from team_seasons
group by season
order by season
```

<Row>
  <LineChart title="Standings spread by season" data="standings_spread" x="season" y="best_win_pct, worst_win_pct" />
  <BarChart title="Teams separated from the pack" data="separated_teams" x="season" y="sixty_win_pct_teams, forty_win_pct_teams" arrange="group" />
</Row>
