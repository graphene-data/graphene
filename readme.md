# Publishing Graphene

To publish, have your agent run the `/publish` command. This will create a diff that updates the changelog and bumps the version. If it looks good, push it to a PR.

When the PR is merged, a tag and release are automatically created.

## Test out new package manually before deloying

Not required, but can be helpful if you've make big structural changes.

1. From `core/cli` run `npm pack` (not pnpm). This will make a tgz of the package.
1. Test it out by creating a simple graphene project, with this dependency: `file:/path/to/core/cli/graphenedata-cli-0.0.1.tgz`
1. `npm install` in that test project. You can repeat this step every time you `pack`.
1. Test it out! I like to ensure that check, run, and serve all work.

When you're happy with the results, bump the version in `cli/package.json`, then run `npm publish --access public`.

## Onboarding new orgs and users

Slightly manual process for now.
1. Create the org in the Stytch UI
2. Create any users in the Stytch UI, make sure to mark them as pending
3. Create the org record in the db
4. Encrypt the connection secret, and generate an id for the connection

```bash
aws login
aws kms encrypt --key-id alias/graphene-secrets --query CiphertextBlob --output text \
     --plaintext fileb:///path/to/read/read.json 
node -e "import('ulid').then(({ulid}) => console.log(ulid()))"
```

5. Insert connection

```sql
INSERT INTO connections ("id", "orgId", "label", "kind", "namespace", "configJson", "updatedAt")
   VALUES (
     '01KMDNKJN5QEE3MYN2H1VSQG65',                 -- pick any unique text id
     'organization-live-81c637f3-adb6-463f-bc3d-a5624e2eb09e',
     'bq',            -- label
     'bigquery',      -- kind
     '',              -- optional default namespace
     'kms:<SECRET>',  -- encrypted service account JSON
     now()
   );
```

6. Send invite via api

```bash
curl --request POST \
  --url https://api.stytch.com/v1/b2b/magic_links/email/invite \
  -u 'project-live-6ce1d97b-eb01-42b7-a849-223d1a431224:<stytch_secret>' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "<org_id>",
    "email_address": "<user_email>"
  }'
```
