This document describes the process for creating a new Graphene project from scratch, connected to your data. If you just want to take Graphene for a quick spin on some demo data, check out our [example project](https://github.com/graphene-data/example-flights).



# Prepare database access

## Local data

Graphene can operate over any local data as long as it is converted into a single `.duckdb` file. If your data isn’t already in this format, it’s very easy these days to tell your coding agent to do it, eg. “convert these 3 .xslx files into a single DuckDB database.” 

## Snowflake

To set up Graphene on a Snowflake connection you will need the following:

- Your Snowflake account identifier
- A service account with `USAGE` and `MONITOR` privileges on all the databases, warehouses, schemas, tables, and views that you want Graphene to query
- A `.p8` key file for the service account saved to your computer

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
    
7. Create the service account, assign the public key to it, and grant it the required privileges. Paste in this sequence of SQL commands and replace all the variables with your details. Note that this script grants Graphene query access to all tables and views in the database; if you need more restricted permissions then feel free to alter this as needed. 
    
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
    

## BigQuery

To set up Graphene on a BigQuery connection you will need the following:

- Your Google Cloud project ID
- A service account with “BigQuery Job User” and “BigQuery Data Viewer” roles
- A `.json` key file for the service account saved to your computer

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

# Set up your Graphene project

[TO DO]   

# Install the IDE extension (optional)

Graphene has extensions for VSCode and Cursor which add syntax highlighting, linting, and hover states to enrich the development experience when working with GSQL and Graphene markdown files. 

The extension is called **Graphene VSCode Language Support** which you can search for and install in **View > Extensions** for both VSCode and Cursor.

# Create your semantic model

Tell your agent to use the `model-gsql` skill to create .gsql files for a small group of tables. Review its work, correct it as necessary, and then tell it to tackle the remaining tables you want modeled. Encourage it to delegate the work to subagents.

If you have an existing semantic model from another tool, you can add that file/project as context and tell the agent to migrate it over. If it's really big, you should migrate it in chunks so that you can review and revise the agent's approach as it goes.

# Add auxiliary context files

[TO DO]
