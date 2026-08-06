This document describes the process for creating a new Graphene project from scratch, connected to your data. If you just want to take Graphene for a quick spin on some demo data, check out our [example project](https://github.com/graphene-data/example-flights).

# Prepare database access

<details>
<summary><h2>XLSX, CSV, etc. via DuckDB</h2></summary>

Graphene can operate over any local data as long as it is converted into a single `.duckdb` file. If your data isn’t already in this format, it’s very easy these days to tell your coding agent to do it, eg. “convert these 3 .xslx files into a single DuckDB database.”
</details>

<details>
<summary><h2>Postgres</h2></summary>

Graphene can connect to any Postgres-compatible database that is reachable from your machine over the standard Postgres protocol. This includes local databases, databases reached through an SSH tunnel or proxy, and hosted Postgres services like Neon, AWS RDS, or Supabase when you already have the host, port, database, user, password, schema, and SSL setting needed to connect.

Provider-specific setup, such as creating an RDS security group rule, starting a tunnel, configuring a cloud SQL proxy, or setting up IAM-based database authentication, should be handled before running the Graphene installer. Graphene stores non-secret connection settings in `package.json` and writes the password to `.env`.

To set up Graphene on a Postgres connection you will need the following:

- Admin (or superuser) access to the database, to create a new read-only user and grant it access
- The database host and port, or a local tunnel that exposes one
- The database name and schema you want Graphene to query, usually `public`
- Whether the connection requires SSL

### Step-by-step instructions

1. Create a read-only user for Graphene. Adjust the database, schema, and password values before running:

    ```sql
    create user graphene_user with password 'REPLACE_WITH_A_STRONG_PASSWORD';
    grant connect on database YOUR_DATABASE to graphene_user;
    grant usage on schema YOUR_SCHEMA to graphene_user;
    grant select on all tables in schema YOUR_SCHEMA to graphene_user;
    grant select on all sequences in schema YOUR_SCHEMA to graphene_user;
    alter default privileges in schema YOUR_SCHEMA grant select on tables to graphene_user;
    alter default privileges in schema YOUR_SCHEMA grant select on sequences to graphene_user;
    ```

2. Confirm that the database is reachable from the machine where Graphene will run. For local or tunneled databases, this is often `localhost:5432`. For hosted databases, use the provider’s hostname and SSL requirement.

### Hosted Postgres notes

Hosted Postgres providers usually work with the same Graphene Postgres connector once their provider-specific prerequisites are handled:

- **AWS RDS/Aurora**: configure networking/security groups or a tunnel first. If you use IAM database authentication, generate the auth token before starting Graphene and expose it as the Postgres password. RDS connections commonly require TLS; when your connection string uses `sslmode=require`, Node may need the AWS RDS CA bundle in its trust store, for example `NODE_EXTRA_CA_CERTS=/path/to/aws-rds-ca-bundle.pem pnpm graphene check`.
- **Neon**: use the pooled or direct Postgres hostname from Neon and enable SSL. Put the Neon password in `.env`, or use `DATABASE_URL`/`POSTGRES_URL` if you prefer a full connection string.
- **Supabase, Crunchy Bridge, Cloud SQL, and similar providers**: use the provider's Postgres host, port, database, user, password, and SSL requirement. If the provider requires a proxy or custom CA certificate, start the proxy or configure Node's CA trust before running Graphene.

</details>

<details>
<summary><h2>Snowflake</h2></summary>

To set up Graphene on a Snowflake connection you will need the following:

- Access to Snowflake with the `ACCOUNTADMIN` role (or an equivalent role that can create users/roles and grant privileges), to provision the service account
- The ability to run `openssl` locally to generate a key pair
- The name of the warehouse and database(s) you want to grant Graphene access to

### Step-by-step instructions

1. Generate a private key file and associated public key. Open Terminal and run the following:

    ```bash
    openssl genrsa 2048 | openssl pkcs8 -topk8 -v2 des3 -inform PEM -out graphene_snowflake_key.p8 && openssl rsa -in graphene_snowflake_key.p8 -pubout -out graphene_snowflake_key.pub
    ```

2. Pick any passphrase but remember it; you’ll need it later.
3. Move the `.p8` file to a dedicated location and make note of the absolute path.
4. Then go to [app.snowflake.com](https://app.snowflake.com/).
5. Go to **Create** (`+` icon) → **SQL worksheet.**
6. Get your Snowflake account identifier (for Graphene setup later):

    ```sql
    select current_organization_name() || '-' || current_account_name();
    ```

7. Create the service account, assign the public key to it, and grant it the required privileges. Paste in this sequence of SQL commands and replace all the variables with your details. Note that this script grants Graphene query access to all tables and views in the database; if you need more restricted permissions then feel free to alter this as needed. Snowflake treats materialized views, external tables, dynamic tables, and Iceberg tables as distinct object types, so if you use any of those, add matching `grant select on all|future <object type> in database ...` lines — otherwise they simply won't show up when Graphene inspects the schema.

    ```sql
    use role ACCOUNTADMIN;

    -- Create the role and service account
    create role if not exists graphene_role;
    create user if not exists graphene_user;
    grant role graphene_role to user graphene_user;
    alter user graphene_user set
      type = service
      default_role = graphene_role
      default_warehouse = 'YOUR_WAREHOUSE'
      rsa_public_key = 'CONTENTS_OF_PUB_RSA_KEY_FILE';

    -- Ability to see warehouse, database, all schemas
    grant usage, monitor on warehouse YOUR_WAREHOUSE to role graphene_role;
    grant usage, monitor on database YOUR_DATABASE to role graphene_role;
    grant usage, monitor on all schemas in database YOUR_DATABASE to role graphene_role;
    grant usage, monitor on future schemas in database YOUR_DATABASE to role graphene_role;

    -- Ability to query all tables in the database
    grant select on all tables in database YOUR_DATABASE to role graphene_role;
    grant select on future tables in database YOUR_DATABASE to role graphene_role;

    -- Ability to query all views in the database
    grant select on all views in database YOUR_DATABASE to role graphene_role;
    grant select on future views in database YOUR_DATABASE to role graphene_role;
    ```

</details>

<details>
<summary><h2>BigQuery</h2></summary>

To set up Graphene on a BigQuery connection you will need the following:

- Your Google Cloud project ID
- Access to that project with permission to create service accounts and grant IAM roles (e.g. Owner/Editor, or the `roles/iam.serviceAccountAdmin` and `roles/resourcemanager.projectIamAdmin` roles), to provision the service account

### Step-by-step instructions

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. In the top right corner, click **Activate Cloud Shell** (command line icon).
3. In Cloud Shell, list your project IDs:

    ```bash
    gcloud projects list --format="table(projectId, name)"
    ```

4. Then paste this in, replacing `PROJECT_ID` with your chosen project ID (you’re free to rename the other two variables as well):

    ```bash
    SA_NAME="graphene-bq"
    KEY_FILE="graphene-bq-key.json"

    # Change this
    PROJECT_ID="PROJECT_ID"
    ```

5. Then run this entire block to create the service account, grant it the required roles, and then generate the key file:

    ```bash
    # Create the Service Account
    gcloud iam service-accounts create "${SA_NAME}" \
        --display-name="BigQuery Job and Data Viewer SA" \
        --project="${PROJECT_ID}"

    # Grant BigQuery Job User Role
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/bigquery.jobUser" \
        --condition=None

    # Grant BigQuery Data Viewer Role
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/bigquery.dataViewer" \
        --condition=None

    # Generate the JSON Private Key
    gcloud iam service-accounts keys create "${KEY_FILE}" \
        --iam-account="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --project="${PROJECT_ID}"
    ```

6. Finally, download the key file by clicking the **three-dot menu (⋮)** in the Cloud Shell header and then clicking **Download.** You will need to unzip the archive. Move the `.json` file into a dedicated location and make note of the absolute path.
</details>

<details>
<summary><h2>ClickHouse</h2></summary>

Graphene can connect to any ClickHouse server reachable over HTTP(S), including self-hosted servers and ClickHouse Cloud.

To set up Graphene on a ClickHouse connection you will need the following:

- Admin access to the ClickHouse server (or ClickHouse Cloud service), to create a new user and grant it `SELECT` privileges
- The full ClickHouse endpoint URL, including protocol and port (e.g. `https://my-instance.clickhouse.cloud:8443` for ClickHouse Cloud, or `http://localhost:8123` for a local server)

### Step-by-step instructions

1. Create a read-only user for Graphene. Adjust the database and password values before running:

    ```sql
    create user graphene_user identified with sha256_password by 'REPLACE_WITH_A_STRONG_PASSWORD';
    grant select on YOUR_DATABASE.* to graphene_user;
    ```

2. If you're using ClickHouse Cloud, find your connection URL under **Connect** in the service's overview page; it will look like `https://<host>.clickhouse.cloud:8443`. For a self-hosted server, use its HTTP(S) interface URL and port (commonly `8123` for HTTP or `8443` for HTTPS).

</details>

<details>
<summary><h2>Athena</h2></summary>

Graphene can query data cataloged in AWS Glue and run through Amazon Athena. The Graphene installer does not currently have built-in support for Athena, so the connection needs to be configured by hand.

To set up Graphene on an Athena connection you will need the following:

- IAM access sufficient to create and attach a policy granting Athena, Glue, and S3 permissions (or an existing role/user with that access)
- Your AWS account ID and region, plus the Glue database and Athena workgroup you want Graphene to use
- An existing S3 bucket, or permission to create one, for Athena to write query results to

### Step-by-step instructions

1. Create an IAM policy granting the minimum permissions Graphene needs, and attach it to the role or user Graphene will run as. Replace the region, account ID, workgroup, and bucket names before applying. The first statement is what powers `graphene schema`; note that the catalog metadata actions must be scoped to the `datacatalog` ARN, not the workgroup.

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "CatalogIntrospection",
          "Effect": "Allow",
          "Action": ["athena:ListDatabases", "athena:ListTableMetadata", "athena:GetTableMetadata"],
          "Resource": "arn:aws:athena:YOUR_REGION:YOUR_ACCOUNT_ID:datacatalog/AwsDataCatalog"
        },
        {
          "Sid": "QueryExecution",
          "Effect": "Allow",
          "Action": [
            "athena:GetWorkGroup",
            "athena:StartQueryExecution",
            "athena:GetQueryExecution",
            "athena:GetQueryResults",
            "athena:StopQueryExecution"
          ],
          "Resource": "arn:aws:athena:YOUR_REGION:YOUR_ACCOUNT_ID:workgroup/YOUR_WORKGROUP"
        },
        {
          "Sid": "GlueDataCatalogRead",
          "Effect": "Allow",
          "Action": [
            "glue:GetDatabase",
            "glue:GetDatabases",
            "glue:GetTable",
            "glue:GetTables",
            "glue:GetPartition",
            "glue:GetPartitions",
            "glue:BatchGetPartition"
          ],
          "Resource": [
            "arn:aws:glue:YOUR_REGION:YOUR_ACCOUNT_ID:catalog",
            "arn:aws:glue:YOUR_REGION:YOUR_ACCOUNT_ID:database/*",
            "arn:aws:glue:YOUR_REGION:YOUR_ACCOUNT_ID:table/*/*"
          ]
        },
        {
          "Sid": "SourceDataRead",
          "Effect": "Allow",
          "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:GetObject"],
          "Resource": ["arn:aws:s3:::YOUR_DATA_BUCKET", "arn:aws:s3:::YOUR_DATA_BUCKET/*"]
        },
        {
          "Sid": "QueryResultsReadWrite",
          "Effect": "Allow",
          "Action": [
            "s3:GetBucketLocation",
            "s3:ListBucket",
            "s3:ListBucketMultipartUploads",
            "s3:ListMultipartUploadParts",
            "s3:AbortMultipartUpload",
            "s3:GetObject",
            "s3:PutObject"
          ],
          "Resource": ["arn:aws:s3:::YOUR_RESULTS_BUCKET", "arn:aws:s3:::YOUR_RESULTS_BUCKET/*"]
        }
      ]
    }
    ```

    The Glue statement needs the `catalog` ARN alongside the database and table ARNs, because Athena requires permissions on a resource *and all of its ancestors* in the Data Catalog. The `glue:GetPartition*` actions are only needed for partitioned tables. If either bucket is encrypted with SSE-KMS, also grant `kms:Decrypt` on the key (plus `kms:Encrypt` and `kms:GenerateDataKey` for the results bucket).

2. Create (or reuse) an S3 bucket for Athena query results, and note its URI (e.g. `s3://graphene-athena-results-staging/`).
3. Because the installer has no Athena option, pick any database when you create your project below, then replace the connection block it writes with an `athena` block under the `graphene` key in `package.json`:

    ```json
    "athena": {
      "region": "us-east-1",
      "catalog": "AwsDataCatalog",
      "database": "YOUR_DATABASE",
      "workGroup": "YOUR_WORKGROUP",
      "outputLocation": "s3://YOUR_RESULTS_BUCKET/"
    }
    ```

4. Provide AWS credentials for Graphene to use. If you're running Graphene somewhere with an IAM role already attached (EC2, ECS, Lambda, etc.), no further configuration is needed and the AWS SDK's default credential chain will be used. Otherwise, add an access key and secret to `.env`:

    ```env
    AWS_ACCESS_KEY_ID=<your-access-key-id>
    AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
    ```

</details>

<details>
<summary><h2>MotherDuck</h2></summary>

To set up Graphene on a MotherDuck connection you will need access to a MotherDuck account, to generate an access token.

### Step-by-step instructions

1. Go to [app.motherduck.com](https://app.motherduck.com/).
2. Navigate to **Settings > Integrations > Access Tokens**.
3. Create a token with type "Read Scaling Token".

MotherDuck uses DuckDB SQL syntax, so Graphene SQL functions and expressions should follow the same rules as local DuckDB projects.

</details>


# Set up your Graphene project

1. In the terminal, navigate to where you want the Graphene project to live. It can be a standalone project or a folder within an existing repo.
2. Run the Graphene installer with npm, yarn, or pnpm:

   ```bash
   npm create graphene
   ```

The installer will walk you through a short series of prompts, create your Graphene project, and test to make sure the database connection is working.

# Install the IDE extension (optional)

Graphene has extensions for VSCode and Cursor which add syntax highlighting, linting, and hover states to enrich the development experience when working with Graphene SQL and Graphene markdown files.

The extension is called **Graphene VSCode Language Support** which you can search for and install in **View > Extensions** for both VSCode and Cursor.

# Create your semantic model

Start a new agent session within the Graphene project. Tell your agent:

>Add .gsql files in a new folder ./tables for [tables you want exposed in Graphene] following the best practices outlined in modeling.md and graphene-sql.md (in the Graphene skill).

Consider adding the following to the prompt when applicable:
- A link or path to a dbt project
- A link or path to a semantic model eg. LookML
- An entity-relationship diagram (ERD)
- This can be a token-heavy process, so consider working on a small batch first, reviewing the output, and then having your agent delegate to parallel subagents for the remainder. This way, you can catch any errors or stylistic preferences up front.

# Add additional context

For best results, we recommend that you add the following to your agent context.

## AGENTS.md (or CLAUDE.md)
In addition to the information that the Graphene installer adds, consider adding the following:
  - Short description of your business/use case
  - Short description of the scope of the data available in the project, and where the .gsql files are located
  - A glossary of internal jargon and acronyms
  - If your schema is highly denormalized, describe the conceptual [ontology](https://en.wikipedia.org/wiki/Ontology_(information_science)) of the entities and relationships in the data with a mermaid-like diagram. For example:

````
# Ontology

Our Salesforce schema is highly denormalized. The following is a conceptual ontology of the data it describes.

```
erDiagram
   ACCOUNT ||--o{ OPPORTUNITY : "has | snapshot at close_date | opportunities.account_id, opportunities.account_name, opportunities.account_industry, opportunities.account_arr, opportunities.account_segment"
   CONTACT }o--o{ OPPORTUNITY : "primary contact on | snapshot at close_date | opportunities.contact_id, opportunities.contact_name, opportunities.contact_title, opportunities.contact_email"
   REP ||--o{ OPPORTUNITY : "owns | closing owner, not current | opportunities.owner_id, opportunities.owner_name, opportunities.owner_team, opportunities.owner_region"
   TERRITORY ||--o{ OPPORTUNITY : "assigned to | at time of close | opportunities.territory_id, opportunities.territory_name, opportunities.territory_region"
   REP }o--|| TERRITORY : "belongs to | opportunities.owner_region = opportunities.territory_region"
   OPPORTUNITY }o--|| dim_date : "opportunities.close_date → dim_date.date"
```
````

## Skills

Agent skills are great for context that's helpful situationally, but not always, like:
- Context about a particular department, how it's structured, and how it operates
- Analytical "cookbooks" that are unique to your business, eg. how to perform cohort analysis in a particular way, how the company expects financial reports to look, etc.

If you aren't familiar with writing agent skills, we recommend you read the excellent guide [here](https://agentskills.io/skill-creation/best-practices).
