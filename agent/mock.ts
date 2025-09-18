export const MockMessages = [
  {
    type: 'system',
    subtype: 'init',
    cwd: '/Users/grant/co/graphene/.wt/loveable/examples/flights',
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    tools: [
      'Task',         'Bash',
      'Glob',         'Grep',
      'ExitPlanMode', 'Read',
      'Edit',         'MultiEdit',
      'Write',        'NotebookEdit',
      'WebFetch',     'TodoWrite',
      'WebSearch',    'BashOutput',
      'KillShell',
    ],
    mcp_servers: [],
    model: 'claude-opus-4-1-20250805',
    permissionMode: 'default',
    slash_commands: [
      'clear',            'compact',
      'context',          'cost',
      'init',             'migrate-installer',
      'output-style:new', 'pr-comments',
      'release-notes',    'statusline',
      'todos',            'review',
      'security-review',  'vim',
    ],
    apiKeySource: '/login managed key',
    output_style: 'default',
    uuid: '2ff0c381-4559-47c5-868a-47a0524e2349',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_01E3e3tehqEDnPLjQfskn7fU',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'text',
          text: "I'll analyze flight delays by carrier for you. Let me first explore the available data and then create a markdown analysis file.",
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 4,
        cache_creation_input_tokens: 1473,
        cache_read_input_tokens: 14807,
        cache_creation: {ephemeral_5m_input_tokens: 1473, ephemeral_1h_input_tokens: 0},
        output_tokens: 3,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '46dfac92-0cad-4e90-be89-a67050a9e0cf',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_01E3e3tehqEDnPLjQfskn7fU',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_01Hj5FqS3knaD52XywPBNVoT',
          name: 'Glob',
          input: {pattern: '**/*.gsql'},
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 4,
        cache_creation_input_tokens: 1473,
        cache_read_input_tokens: 14807,
        cache_creation: {ephemeral_5m_input_tokens: 1473, ephemeral_1h_input_tokens: 0},
        output_tokens: 3,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '065f5e6e-183e-42f3-b434-e1426ba7afe8',
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          tool_use_id: 'toolu_01Hj5FqS3knaD52XywPBNVoT',
          type: 'tool_result',
          content: '/Users/grant/co/graphene/.wt/loveable/examples/flights/models.gsql',
        },
      ],
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '99a178a2-03a3-4dba-abc7-f35a24985fbf',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_01JgEM9XC3wfgEShDD3wiJ2E',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_01L5WKGWihHhCu5a1JHv4n9z',
          name: 'Read',
          input: {
            file_path: '/Users/grant/co/graphene/.wt/loveable/examples/flights/models.gsql',
          },
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 7,
        cache_creation_input_tokens: 113,
        cache_read_input_tokens: 16280,
        cache_creation: {ephemeral_5m_input_tokens: 113, ephemeral_1h_input_tokens: 0},
        output_tokens: 76,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: 'ec2a9a53-8437-423f-8529-161475e9bbff',
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          tool_use_id: 'toolu_01L5WKGWihHhCu5a1JHv4n9z',
          type: 'tool_result',
          content: '     1→table flights (\n' +
          '     2→  id2 BIGINT primary_key -- #hide\n' +
          '     3→  carrier VARCHAR -- The carrier code for the airline operating the flight. Keys into the carriers table.\n' +
          '     4→  origin VARCHAR -- The origin airport code. Keys into the airports table.\n' +
          '     5→  destination VARCHAR -- The destination airport code. Keys into the airports table.\n' +
          '     6→  flight_num VARCHAR -- The flight number.\n' +
          '     7→  flight_time BIGINT -- The flight duration in minutes.\n' +
          '     8→  tail_num VARCHAR -- The tail number of the aircraft, which is a unique identifier for the aircraft. Keys into the aircraft table.\n' +
          '     9→  dep_time TIMESTAMP -- The departure time (UTC) of the flight.\n' +
          '    10→  arr_time TIMESTAMP -- The arrival time (UTC) of the flight.\n' +
          '    11→  dep_delay BIGINT -- How delayed the departure time was in minutes.\n' +
          '    12→  arr_delay BIGINT -- How delayed the arrival time was in minutes.\n' +
          '    13→  taxi_out BIGINT -- The time it took to taxi out of the airport in minutes.\n' +
          '    14→  taxi_in BIGINT -- The time it took to taxi into the airport in minutes.\n' +
          '    15→  distance BIGINT -- The distance of the flight in miles.\n' +
          '    16→  cancelled VARCHAR -- #hide\n' +
          '    17→  diverted VARCHAR -- #hide\n' +
          '    18→\n' +
          '    19→  id2 as id\n' +
          "    20→  cancelled = 'Y' as is_cancelled\n" +
          "    21→  diverted = 'Y' as is_diverted\n" +
          '    22→  flight_time > 360 as is_long_haul -- Whether the flight was a long haul flight (over 6 hours).\n' +
          '    23→\n' +
          '    24→  join_one aircraft on aircraft.tail_num = tail_num\n' +
          '    25→  join_one carriers on carriers.code = carrier\n' +
          '    26→  join_one airports as origin_airport on origin_airport.code = origin\n' +
          '    27→  join_one airports as destination_airport on destination_airport.code = destination\n' +
          '    28→)\n' +
          '    29→\n' +
          '    30→table aircraft (\n' +
          '    31→  tail_num VARCHAR primary_key -- The unique tail number identifier for the aircraft.\n' +
          "    32→  aircraft_serial VARCHAR -- The manufacturer's serial number for the aircraft.\n" +
          '    33→  aircraft_model_code VARCHAR -- The aircraft model code. Keys into the aircraft_models table.\n' +
          '    34→  aircraft_engine_code VARCHAR -- The engine model code for the aircraft.\n' +
          '    35→  year_built BIGINT -- The year the aircraft was manufactured.\n' +
          '    36→  aircraft_type_id BIGINT -- The type identifier for the aircraft (e.g., 4=airplane, 5=helicopter).\n' +
          '    37→  aircraft_engine_type_id BIGINT -- The engine type identifier for the aircraft.\n' +
          '    38→  registrant_type_id BIGINT -- The registrant type identifier (e.g., 1=individual, 3=corporation).\n' +
          '    39→  name VARCHAR -- The name of the aircraft owner/registrant.\n' +
          "    40→  address1 VARCHAR -- The first line of the owner's address.\n" +
          "    41→  address2 VARCHAR -- The second line of the owner's address.\n" +
          '    42→  city VARCHAR -- The city where the owner is located.\n' +
          '    43→  state VARCHAR -- The state where the owner is located.\n' +
          "    44→  zip VARCHAR -- The ZIP code of the owner's address.\n" +
          '    45→  region VARCHAR -- The FAA region code (e.g., E=Eastern, S=Southern, W=Western).\n' +
          '    46→  county VARCHAR -- The county code where the owner is located.\n' +
          '    47→  country VARCHAR -- The country code (e.g., US=United States).\n' +
          '    48→  certification VARCHAR -- The aircraft certification type (e.g., 1N=normal, 1T=transport).\n' +
          '    49→  status_code VARCHAR -- The current status of the aircraft (e.g., A=active, V=valid).\n' +
          '    50→  mode_s_code VARCHAR -- The Mode S transponder code for the aircraft.\n' +
          '    51→  fract_owner VARCHAR -- The fractional ownership indicator.\n' +
          '    52→  last_action_date DATE -- The date of the last action taken on the aircraft registration.\n' +
          '    53→  cert_issue_date DATE -- The date the aircraft certification was issued.\n' +
          '    54→  air_worth_date DATE -- The date the aircraft was determined to be airworthy.\n' +
          '    55→\n' +
          '    56→  join_one aircraft_models as model on aircraft_model_code = model.aircraft_model_code\n' +
          '    57→  join_many flights on tail_num = flights.tail_num\n' +
          '    58→)\n' +
          '    59→\n' +
          '    60→table aircraft_models (\n' +
          '    61→  aircraft_model_code VARCHAR primary_key -- The unique aircraft model code identifier.\n' +
          '    62→  manufacturer VARCHAR -- The manufacturer of the aircraft (e.g., BOEING, CESSNA).\n' +
          '    63→  model VARCHAR -- The specific model name or designation.\n' +
          '    64→  aircraft_type_id BIGINT -- The aircraft type identifier (e.g., 2=balloon, 4=airplane, 5=helicopter).\n' +
          '    65→  aircraft_engine_type_id BIGINT -- The engine type identifier for this model.\n' +
          '    66→  aircraft_category_id BIGINT -- The aircraft category identifier.\n' +
          '    67→  amateur BIGINT -- Whether this is an amateur-built aircraft (0=no, 1=yes).\n' +
          '    68→  engines BIGINT -- The number of engines on this aircraft model.\n' +
          '    69→  seats BIGINT -- The number of seats in this aircraft model.\n' +
          '    70→  weight BIGINT -- The weight class of the aircraft model.\n' +
          '    71→  speed BIGINT -- The maximum speed of the aircraft model in knots.\n' +
          '    72→\n' +
          '    73→  join_many aircraft on aircraft_model_code = aircraft.aircraft_model_code\n' +
          '    74→)\n' +
          '    75→\n' +
          '    76→table carriers (\n' +
          '    77→  code VARCHAR primary_key -- The unique carrier code identifier (e.g., AA, DL, UA).\n' +
          '    78→  name VARCHAR -- The full name of the airline carrier.\n' +
          '    79→  nickname VARCHAR -- The abbreviated or nickname of the carrier.\n' +
          '    80→\n' +
          '    81→  join_many flights on code = flights.carrier\n' +
          '    82→)\n' +
          '    83→\n' +
          '    84→table airports (\n' +
          '    85→  id BIGINT primary_key -- The unique airport identifier.\n' +
          '    86→  code VARCHAR -- The three-letter airport code (e.g., JFK, LAX).\n' +
          '    87→  site_number VARCHAR -- The FAA site number for the airport.\n' +
          '    88→  fac_type VARCHAR -- The facility type (e.g., AIRPORT, HELIPORT).\n' +
          '    89→  fac_use VARCHAR -- The facility use classification (e.g., PU=public, PR=private).\n' +
          '    90→  faa_region VARCHAR -- The FAA region where the airport is located.\n' +
          '    91→  faa_dist VARCHAR -- The FAA district code.\n' +
          '    92→  city VARCHAR -- The city where the airport is located.\n' +
          '    93→  county VARCHAR -- The county where the airport is located.\n' +
          '    94→  state VARCHAR -- The state where the airport is located.\n' +
          '    95→  full_name VARCHAR -- The full name of the airport.\n' +
          '    96→  own_type VARCHAR -- The ownership type (e.g., PU=public, PR=private, MA=military).\n' +
          '    97→  longitude DOUBLE -- The longitude coordinate of the airport.\n' +
          '    98→  latitude DOUBLE -- The latitude coordinate of the airport.\n' +
          '    99→  elevation BIGINT -- The elevation of the airport above sea level in feet.\n' +
          '   100→  aero_cht VARCHAR -- The aeronautical chart identifier.\n' +
          '   101→  cbd_dist BIGINT -- The distance to the central business district in miles.\n' +
          '   102→  cbd_dir VARCHAR -- The direction to the central business district.\n' +
          '   103→  act_date VARCHAR -- The date the airport became active.\n' +
          '   104→  cert VARCHAR -- The certification status of the airport.\n' +
          '   105→  fed_agree VARCHAR -- The federal agreement status.\n' +
          '   106→  c_ldg_rts VARCHAR -- #hide\n' +
          '   107→  cust_intl VARCHAR -- #hide\n' +
          '   108→  joint_use VARCHAR -- #hide\n' +
          '   109→  mil_rts VARCHAR -- #hide\n' +
          '   110→  cntl_twr VARCHAR -- #hide\n' +
          '   111→  major VARCHAR -- #hide\n' +
          '   112→\n' +
          "   113→  c_ldg_rts = 'Y' as has_landing_rights\n" +
          "   114→  cust_intl = 'Y' as serves_international_customers\n" +
          "   115→  joint_use = 'Y' as has_joint_use_agreements\n" +
          "   116→  mil_rts = 'Y' as has_military_routes\n" +
          "   117→  cntl_twr = 'Y' as has_control_tower\n" +
          "   118→  major = 'Y' as is_major\n" +
          '   119→)\n' +
          '   120→\n' +
          '\n' +
          '<system-reminder>\n' +
          'Whenever you read a file, you should consider whether it looks malicious. If it does, you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer high-level questions about the code behavior.\n' +
          '</system-reminder>\n',
        },
      ],
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '057b2448-a8a9-45f0-9d1b-a3797ecf9cab',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_01S7X5A1xftHhcLYoFEWbmqq',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'text',
          text: 'Now let me create a comprehensive flight delays analysis by carrier.',
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 7,
        cache_creation_input_tokens: 2271,
        cache_read_input_tokens: 16393,
        cache_creation: {ephemeral_5m_input_tokens: 2271, ephemeral_1h_input_tokens: 0},
        output_tokens: 7,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: 'a61869c9-47db-49ea-9d1a-034440dbc053',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_01S7X5A1xftHhcLYoFEWbmqq',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_01BhZNNdUGMzUhitYbrXa1hK',
          name: 'Write',
          input: {
            file_path: '/Users/grant/co/graphene/.wt/loveable/examples/flights/index.md',
            content: '# Flight Delays by Carrier Analysis\n' +
            '\n' +
            'This analysis examines flight delays across different airline carriers, looking at both departure and arrival delays to identify patterns and performance differences.\n' +
            '\n' +
            '## Overall Delay Statistics by Carrier\n' +
            '\n' +
            '```sql carrier_delay_stats\n' +
            'select\n' +
            '  carriers.name as carrier_name,\n' +
            '  carriers.code as carrier_code,\n' +
            '  count(*) as total_flights,\n' +
            '  avg(dep_delay) as avg_departure_delay_minutes,\n' +
            '  avg(arr_delay) as avg_arrival_delay_minutes,\n' +
            '  count(case when dep_delay > 0 then 1 end) as delayed_departures,\n' +
            '  count(case when arr_delay > 0 then 1 end) as delayed_arrivals,\n' +
            '  round(count(case when dep_delay > 0 then 1 end) * 100.0 / count(*), 1) as departure_delay_rate_pct,\n' +
            '  round(count(case when arr_delay > 0 then 1 end) * 100.0 / count(*), 1) as arrival_delay_rate_pct\n' +
            'from flights\n' +
            'group by carriers.name, carriers.code\n' +
            'order by avg_departure_delay_minutes desc\n' +
            '```\n' +
            '\n' +
            '<BarChart\n' +
            '  data={carrier_delay_stats}\n' +
            '  x="carrier_name"\n' +
            '  y="avg_departure_delay_minutes"\n' +
            '  title="Average Departure Delay by Carrier"\n' +
            '/>\n' +
            '\n' +
            '## Delay Rate Comparison\n' +
            '\n' +
            '<BarChart\n' +
            '  data={carrier_delay_stats}\n' +
            '  x="carrier_name"\n' +
            '  y="departure_delay_rate_pct"\n' +
            '  title="Percentage of Flights with Departure Delays"\n' +
            '/>\n' +
            '\n' +
            '## Detailed Delay Performance Table\n' +
            '\n' +
            '<Table data={carrier_delay_stats} />\n' +
            '\n' +
            '## Severe Delays Analysis (>60 minutes)\n' +
            '\n' +
            '```sql severe_delays\n' +
            'select\n' +
            '  carriers.name as carrier_name,\n' +
            '  count(case when dep_delay > 60 then 1 end) as severe_departure_delays,\n' +
            '  count(case when arr_delay > 60 then 1 end) as severe_arrival_delays,\n' +
            '  round(count(case when dep_delay > 60 then 1 end) * 100.0 / count(*), 2) as severe_dep_delay_rate_pct,\n' +
            '  round(count(case when arr_delay > 60 then 1 end) * 100.0 / count(*), 2) as severe_arr_delay_rate_pct,\n' +
            '  count(*) as total_flights\n' +
            'from flights\n' +
            'group by carriers.name\n' +
            'order by severe_dep_delay_rate_pct desc\n' +
            '```\n' +
            '\n' +
            '<BarChart\n' +
            '  data={severe_delays}\n' +
            '  x="carrier_name"\n' +
            '  y="severe_dep_delay_rate_pct"\n' +
            '  title="Severe Departure Delays (>60 min) Rate by Carrier"\n' +
            '/>\n' +
            '\n' +
            '## Monthly Delay Trends\n' +
            '\n' +
            '```sql monthly_delays\n' +
            'select\n' +
            '  carriers.name as carrier_name,\n' +
            "  date_trunc('month', dep_time) as month,\n" +
            '  avg(dep_delay) as avg_departure_delay,\n' +
            '  avg(arr_delay) as avg_arrival_delay\n' +
            'from flights\n' +
            'where dep_time is not null\n' +
            "group by carriers.name, date_trunc('month', dep_time)\n" +
            'order by month, carrier_name\n' +
            '```\n' +
            '\n' +
            '<LineChart\n' +
            '  data={monthly_delays}\n' +
            '  x="month"\n' +
            '  y="avg_departure_delay"\n' +
            '  series="carrier_name"\n' +
            '  title="Monthly Average Departure Delays by Carrier"\n' +
            '/>\n' +
            '\n' +
            '## Key Insights\n' +
            '\n' +
            '- This analysis shows the performance of different airline carriers in terms of flight delays\n' +
            '- Both departure and arrival delays are analyzed to provide a comprehensive view\n' +
            '- Severe delays (>60 minutes) are highlighted as they have the most impact on passengers\n' +
            '- Monthly trends help identify seasonal patterns or improvement/deterioration over time',
          },
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 7,
        cache_creation_input_tokens: 2271,
        cache_read_input_tokens: 16393,
        cache_creation: {ephemeral_5m_input_tokens: 2271, ephemeral_1h_input_tokens: 0},
        output_tokens: 1037,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: 'c935181b-7401-4bdf-93cf-635398bbd839',
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          tool_use_id: 'toolu_01BhZNNdUGMzUhitYbrXa1hK',
          type: 'tool_result',
          content: 'File created successfully at: /Users/grant/co/graphene/.wt/loveable/examples/flights/index.md',
        },
      ],
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '24059b53-7352-4601-a5d9-3e5e47a0cff9',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg_016YcASS4oSyYqR1UKjSRYgc',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'text',
          text: "I've created a comprehensive flight delays analysis by carrier. The analysis includes:\n" +
          '\n' +
          '1. **Overall delay statistics** - Average delays, delay rates, and total flights per carrier\n' +
          '2. **Visual comparisons** - Bar charts showing average delays and delay percentages\n' +
          '3. **Detailed performance table** - Complete metrics for all carriers\n' +
          '4. **Severe delays analysis** - Focus on delays over 60 minutes\n' +
          '5. **Monthly trends** - Time series analysis of delay patterns\n' +
          '\n' +
          'The analysis uses the flights data with joins to the carriers table to show both carrier codes and full names, providing insights into which airlines have the best and worst delay performance.',
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 7,
        cache_creation_input_tokens: 1066,
        cache_read_input_tokens: 18664,
        cache_creation: {ephemeral_5m_input_tokens: 1066, ephemeral_1h_input_tokens: 0},
        output_tokens: 1,
        service_tier: 'standard',
      },
    },
    parent_tool_use_id: null,
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    uuid: '4604f935-eae5-4ff6-ad79-7ff4f59ac16e',
  },
  {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 31376,
    duration_api_ms: 31065,
    num_turns: 9,
    result: "I've created a comprehensive flight delays analysis by carrier. The analysis includes:\n" +
    '\n' +
    '1. **Overall delay statistics** - Average delays, delay rates, and total flights per carrier\n' +
    '2. **Visual comparisons** - Bar charts showing average delays and delay percentages\n' +
    '3. **Detailed performance table** - Complete metrics for all carriers\n' +
    '4. **Severe delays analysis** - Focus on delays over 60 minutes\n' +
    '5. **Monthly trends** - Time series analysis of delay patterns\n' +
    '\n' +
    'The analysis uses the flights data with joins to the carriers table to show both carrier codes and full names, providing insights into which airlines have the best and worst delay performance.',
    session_id: 'c4f18f53-e918-4e9b-bcb3-177a1f39f5f7',
    total_cost_usd: 0.05835944999999999,
    usage: {
      input_tokens: 25,
      cache_creation_input_tokens: 4923,
      cache_read_input_tokens: 66144,
      output_tokens: 1332,
      server_tool_use: {web_search_requests: 0},
      service_tier: 'standard',
      cache_creation: {ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 4923},
    },
    modelUsage: {
      'claude-sonnet-4-20250514': {
        inputTokens: 25,
        outputTokens: 1332,
        cacheReadInputTokens: 66144,
        cacheCreationInputTokens: 4923,
        webSearchRequests: 0,
        costUSD: 0.05835944999999999,
      },
    },
    permission_denials: [],
    uuid: '57271be1-defe-4f76-b821-c307b774674b',
  },
]
