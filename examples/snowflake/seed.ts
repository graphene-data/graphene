// Seeds the Terraform-managed Snowflake fixture from an immutable month of official NYC TLC trip data.
// Source files are downloaded locally, uploaded through a temporary Snowflake stage, then removed after normalized tables are built.
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {SnowflakeConnection} from '../../cli/connections/snowflake.ts'

const tripUrl = 'https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2025-01.parquet'
const zoneUrl = 'https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv'

// Downloads one NYC TLC source file without adding it to the repository.
async function download (url:string, destination:string) {
  let response = await fetch(url)
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

// Replaces the fixture tables with the normalized January 2025 snapshot.
async function seed () {
  let workingDir = await mkdtemp(path.join(tmpdir(), 'graphene-snowflake-seed-'))
  let tripPath = path.join(workingDir, 'yellow_tripdata_2025-01.parquet')
  let zonePath = path.join(workingDir, 'taxi_zone_lookup.csv')
  await Promise.all([download(tripUrl, tripPath), download(zoneUrl, zonePath)])

  let connection = new SnowflakeConnection({
    account: 'adarjvr-ve40413', username: 'GRAPHENE_TERRAFORM_STAGING', privateKey: process.env.SNOWFLAKE_TERRAFORM_PRIVATE_KEY,
    timeout: 600_000, sessionParameters: {STATEMENT_TIMEOUT_IN_SECONDS: 600},
  })

  let statements = [
    'use warehouse COMPUTE_WH',
    'use schema NYC_TAXI_DATA.PUBLIC',
    'create or replace stage SEED_STAGE directory = (enable = true)',
    'create or replace file format PARQUET_FORMAT type = parquet',
    'create or replace file format CSV_FORMAT type = csv skip_header = 1 field_optionally_enclosed_by = \'"\'',
    `put file://${tripPath} @SEED_STAGE auto_compress = false overwrite = true`,
    `put file://${zonePath} @SEED_STAGE auto_compress = false overwrite = true`,
    `create or replace table TAXI_ZONES as
      select $1::number as location_id, $2::text as borough, $3::text as zone, $4::text as service_zone
      from @SEED_STAGE/taxi_zone_lookup.csv (file_format => CSV_FORMAT)`,
    `create or replace table YELLOW_TRIPS as
      select
        $1:VendorID::number as vendor_id,
        to_timestamp_ntz($1:tpep_pickup_datetime::number, 6) as pickup_datetime,
        to_timestamp_ntz($1:tpep_dropoff_datetime::number, 6) as dropoff_datetime,
        $1:passenger_count::number as passenger_count,
        $1:trip_distance::float as trip_distance,
        $1:RatecodeID::number as rate_code_id,
        $1:store_and_fwd_flag::text as store_and_fwd_flag,
        $1:PULocationID::number as pickup_location_id,
        $1:DOLocationID::number as dropoff_location_id,
        $1:payment_type::number as payment_type,
        $1:fare_amount::float as fare_amount,
        $1:extra::float as extra,
        $1:mta_tax::float as mta_tax,
        $1:tip_amount::float as tip_amount,
        $1:tolls_amount::float as tolls_amount,
        $1:improvement_surcharge::float as improvement_surcharge,
        $1:total_amount::float as total_amount,
        $1:congestion_surcharge::float as congestion_surcharge,
        $1:Airport_fee::float as airport_fee,
        $1:cbd_congestion_fee::float as cbd_congestion_fee
      from @SEED_STAGE/yellow_tripdata_2025-01.parquet (file_format => PARQUET_FORMAT)
      where to_timestamp_ntz($1:tpep_pickup_datetime::number, 6) >= '2025-01-01'
        and to_timestamp_ntz($1:tpep_pickup_datetime::number, 6) < '2025-02-01'`,
    'drop stage SEED_STAGE',
    'drop file format PARQUET_FORMAT',
    'drop file format CSV_FORMAT',
  ]

  try {
    for (let statement of statements) await connection.runQuery(statement)
  } finally {
    await connection.close()
    await rm(workingDir, {recursive: true})
  }
}

await seed()
