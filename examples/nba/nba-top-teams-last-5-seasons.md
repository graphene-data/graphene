---
title: NBA Top Teams, Last 5 Seasons
layout: dashboard
---

```sql recent_team_games
select *
from team_game
where season_type = 'Regular Season'
  and season >= 2020
  and season <= 2024
  and fga is not null
```

```sql top_teams
select
  team,
  count(*) as games,
  sum(case when wl = 'W' then 1 else 0 end) as wins,
  sum(case when wl = 'L' then 1 else 0 end) as losses,
  round(sum(case when wl = 'W' then 1 else 0 end) / count(*) * 100, 1) as win_pct,
  round((sum(for_points) - sum(against_points)) / count(*), 1) as net_points_per_game
from recent_team_games
group by team
having count(*) >= 300
order by wins desc
limit 10
```

<BarChart title="Top NBA teams by regular-season wins, 2020–21 through 2024–25" data="top_teams" x="team" y="wins" label sort="wins desc" height="420px" />

<Table title="Top 10 teams" data="top_teams" sortable rows=10 compact>
  <Column id="team" title="Team" />
  <Column id="wins" title="Wins" align="right" />
  <Column id="losses" title="Losses" align="right" />
  <Column id="win_pct" title="Win %" align="right" />
  <Column id="net_points_per_game" title="Net Pts/G" align="right" />
</Table>
