---
title: The Arc and the Edge
layout: notebook
---

NBA offenses have moved steadily behind the 3-point line. [NBA.com describes](https://www.nba.com/news/3-point-era-nba-75) 3-point attempts as rising from a novelty to nearly two-fifths of all field-goal attempts by 2020-21. That shift raises a useful question for this dataset: did the more perimeter-oriented league also flatten home-court advantage?

This notebook tests a simple version of the idea raised by [Harvard Sports Analysis](https://harvardsportsanalysis.org/2017/03/nba-home-court-advantage-is-in-decline-are-3s-to-blame/): if games are decided more by jump shooting and less by paint pressure, free throws, and foul calls, the home floor may matter less than it used to.

```sql season_trends
with regular_seasons as (
  from game
  select
    season,
    games,
    home_win_pct * 100 as home_win_pct,
    avg_three_point_rate * 100 as three_point_rate,
    avg_team_3pa_per_game as team_3pa_per_game,
    avg_team_pts_per_game as team_pts_per_game,
    avg_home_fta_diff as home_fta_diff,
    avg_away_minus_home_pf as away_minus_home_pf
  where season_type = 'Regular Season'
    and fga_home is not null
    and fga_away is not null
)
from regular_seasons
select *
where games >= 900
order by season
```

```sql correlation_summary
from season_trends
select
  round(corr(three_point_rate, home_win_pct), 2) as three_point_home_corr,
  min(season) as first_season,
  max(season) as last_season,
  count() as seasons
```

```sql era_summary
from season_trends
select
  case
    when season between 1982 and 1989 then '1980s'
    when season between 1990 and 1999 then '1990s'
    when season between 2000 and 2009 then '2000s'
    when season between 2010 and 2019 then '2010s'
    else '2020s'
  end as era,
  count() as seasons,
  round(avg(home_win_pct), 1) as home_win_pct,
  round(avg(three_point_rate), 1) as three_point_rate,
  round(avg(team_3pa_per_game), 1) as team_3pa_per_game,
  round(avg(team_pts_per_game), 1) as team_pts_per_game,
  round(avg(home_fta_diff), 2) as home_fta_diff,
  round(avg(away_minus_home_pf), 2) as away_minus_home_pf
order by era
```

```sql headline_values
from era_summary
select
  max(case when era = '1980s' then home_win_pct end) as home_win_1980s,
  max(case when era = '2020s' then home_win_pct end) as home_win_2020s,
  max(case when era = '1980s' then three_point_rate end) as three_point_rate_1980s,
  max(case when era = '2020s' then three_point_rate end) as three_point_rate_2020s,
  max(case when era = '1980s' then team_3pa_per_game end) as team_3pa_1980s,
  max(case when era = '2020s' then team_3pa_per_game end) as team_3pa_2020s
```

From <Value data=correlation_summary column=first_season /> through <Value data=correlation_summary column=last_season />, regular-season 3-point rate and home win percentage move in opposite directions with a season-level correlation of **<Value data=correlation_summary column=three_point_home_corr />**. The average home win rate falls from **<Value data=headline_values column=home_win_1980s />%** in the 1980s to **<Value data=headline_values column=home_win_2020s />%** in the 2020s, while 3-point rate rises from **<Value data=headline_values column=three_point_rate_1980s />%** to **<Value data=headline_values column=three_point_rate_2020s />%**.

<LineChart
  title="Home-court edge and 3-point rate moved in opposite directions"
  data="season_trends"
  x="season"
  y="home_win_pct, three_point_rate"
  height="420px"
/>

```sql season_scatter
from season_trends
select
  season,
  case
    when season between 1982 and 1989 then '1980s'
    when season between 1990 and 1999 then '1990s'
    when season between 2000 and 2009 then '2000s'
    when season between 2010 and 2019 then '2010s'
    else '2020s'
  end as era,
  round(home_win_pct, 1) as home_win_pct,
  round(three_point_rate, 1) as three_point_rate,
  round(team_3pa_per_game, 1) as team_3pa_per_game
order by season
```

<ScatterPlot
  title="Every season shifts the league down and to the right"
  data="season_scatter"
  x="three_point_rate"
  y="home_win_pct"
  splitBy="era"
  height="420px"
/>

The long-run shape is the story. In the 1980s, the average team took just **<Value data=headline_values column=team_3pa_1980s />** threes per game. In the 2020s, the average team took **<Value data=headline_values column=team_3pa_2020s />**. Home teams still win more often than road teams, but the advantage is smaller in the highest-3P era.

<Table title="Era summary" data="era_summary" sortable rows=10 compact>
  <Column id="era" title="Era" />
  <Column id="seasons" title="Seasons" align="right" />
  <Column id="home_win_pct" title="Home Win %" align="right" />
  <Column id="three_point_rate" title="3P Rate %" align="right" />
  <Column id="team_3pa_per_game" title="Team 3PA/G" align="right" />
  <Column id="team_pts_per_game" title="Team PTS/G" align="right" />
  <Column id="home_fta_diff" title="Home FTA Diff" align="right" />
  <Column id="away_minus_home_pf" title="Away - Home PF" align="right" />
</Table>

The supporting columns point in the same direction as the hypothesis. The home team free-throw edge and the away-minus-home personal foul gap both shrink across eras. That does not prove officiating caused home-court advantage to fall, but it does show the older version of home court came with more visible foul-line separation.

```sql recent_game_profiles
with game_profiles as (
  from game
  select
    game_id,
    season,
    three_point_rate * 100 as three_point_rate,
    home_win_flag * 100 as home_win,
    home_fta_diff,
    away_minus_home_pf
  where season_type = 'Regular Season'
    and season between 2013 and 2022
    and fga_home is not null
    and fga_away is not null
),
bucketed as (
  from game_profiles
  select
    *,
    case
      when three_point_rate < 28.4 then 'Low 3P'
      when three_point_rate < 33.9 then 'Moderate 3P'
      when three_point_rate < 39.1 then 'High 3P'
      else 'Very high 3P'
    end as shot_profile
)
from bucketed
select
  shot_profile,
  count() as games,
  round(min(three_point_rate), 1) as min_three_point_rate,
  round(max(three_point_rate), 1) as max_three_point_rate,
  round(avg(home_win), 1) as home_win_pct,
  round(avg(home_fta_diff), 2) as home_fta_diff,
  round(avg(away_minus_home_pf), 2) as away_minus_home_pf
order by min_three_point_rate
```

<Row>
  <BarChart
    title="In recent high-3P games, home teams win less often"
    data="recent_game_profiles"
    x="shot_profile"
    y="home_win_pct"
    label
    height="320px"
  />
  <BarChart
    title="The foul gap is also smaller in high-3P games"
    data="recent_game_profiles"
    x="shot_profile"
    y="away_minus_home_pf"
    label
    height="320px"
  />
</Row>

These buckets look only at the 2013-14 through 2022-23 regular seasons, when the whole league was already taking threes seriously. Even within that modern period, the highest-3P games show a smaller home win rate than lower-3P games.

```sql three_point_line_window
from season_trends
select
  season,
  games,
  round(home_win_pct, 1) as home_win_pct,
  round(three_point_rate, 1) as three_point_rate,
  round(team_3pa_per_game, 1) as team_3pa_per_game
where season between 1992 and 1998
order by season
```

<LineChart
  title="The shortened-line spike is visible in the mid-1990s"
  data="three_point_line_window"
  x="season"
  y="three_point_rate, team_3pa_per_game"
  height="320px"
/>

The mid-1990s are a reminder to treat this as historical analysis, not a clean lab experiment. The NBA shortened the 3-point line for several seasons, and the data shows that policy change as a visible spike before attempts settle back and then resume their modern climb.

```sql team_games
from game
select
  season,
  home_team.full_name as team,
  fg3a_home as fg3a,
  fga_home as fga,
  wl_home as wl
where season_type = 'Regular Season'
  and fga_home is not null
union all
from game
select
  season,
  away_team.full_name as team,
  fg3a_away as fg3a,
  fga_away as fga,
  wl_away as wl
where season_type = 'Regular Season'
  and fga_away is not null
```

```sql all_team_seasons
from team_games
select
  season,
  case
    when season between 1982 and 1989 then '1980s'
    when season between 1990 and 1999 then '1990s'
    when season between 2000 and 2009 then '2000s'
    when season between 2010 and 2019 then '2010s'
    else '2020s'
  end as era,
  team,
  count() as games,
  round(avg(fg3a / nullif(fga, 0)) * 100, 1) as three_point_rate,
  round(avg(fg3a), 1) as threes_attempted,
  round(avg(case when wl = 'W' then 1.0 else 0.0 end) * 100, 1) as win_pct
where games >= 65
  and season >= 1982
order by season
```

<ScatterPlot
  title="Team seasons reveal the modern 3-point frontier"
  data="all_team_seasons"
  x="three_point_rate"
  y="win_pct"
  splitBy="era"
  height="460px"
/>

```sql top_three_point_team_seasons
from all_team_seasons
select
  season,
  team,
  games,
  three_point_rate,
  threes_attempted,
  win_pct
order by three_point_rate desc
limit 12
```

<Table title="Most 3-point-heavy team seasons" data="top_three_point_team_seasons" sortable rows=12 compact>
  <Column id="season" title="Season" />
  <Column id="team" title="Team" />
  <Column id="games" title="Games" align="right" />
  <Column id="three_point_rate" title="3P Rate %" align="right" />
  <Column id="threes_attempted" title="3PA/G" align="right" />
  <Column id="win_pct" title="Win %" align="right" />
</Table>

The team table shows how recently the extreme perimeter style arrived. The top of the list is dominated by late-2010s and early-2020s teams, led by Houston's high-volume seasons and then spread across the rest of the league.

The conclusion is deliberately modest: this data does not prove 3-point shooting caused home-court advantage to decline. It does show that the two league-wide trends line up strongly, that the old home edge was paired with a larger foul-line gap, and that Graphene can express the story through reusable modeled fields, implicit team joins, query DAGs, values, charts, and tables.
