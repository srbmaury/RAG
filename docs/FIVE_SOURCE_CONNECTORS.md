# Connected source setup

Atlas supports read-only searches across Google Calendar, Linear, Jira,
OneDrive, Outlook and SharePoint. Connect accounts from **Sources** and enable them per
question in **Ask Atlas**. Credentials are encrypted and scoped to a workspace.

## Google Calendar OAuth

Use the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
Enable the Google Calendar API and register this additional redirect in the
Google Cloud OAuth client:

`http://localhost:3000/api/connected-oauth/calendar/callback`

Atlas requests `calendar.readonly`, refreshes the credential when searching,
and searches the primary calendar's available event text.

## Microsoft OneDrive, Outlook and SharePoint OAuth

Register an Azure/Entra app that supports organizational accounts and add
the redirect URIs:

`http://localhost:3000/api/connected-oauth/onedrive/callback`

`http://localhost:3000/api/connected-oauth/outlook/callback`

`http://localhost:3000/api/connected-oauth/sharepoint/callback`

Configure `MICROSOFT_CLIENT_ID` and, when using a confidential web
application, `MICROSOFT_CLIENT_SECRET`. The scopes requested are
`User.Read Files.Read offline_access` (OneDrive) and
`User.Read Mail.Read offline_access` (Outlook) and
`User.Read Sites.Read.All Files.Read.All offline_access` (SharePoint), with profile/OpenID scopes.
SharePoint queries use delegated Graph search to retrieve accessible file metadata and snippets.
Full file content extraction or background indexing is **not** included.

OneDrive currently searches metadata in the user's default drive rather than
SharePoint or file contents. Outlook searches message subjects and previews.
These connectors do not index or cache full remote content.

## Public deployments

Configure `ATLAS_CONNECTED_OAUTH_REDIRECT_BASE` to the exact HTTPS public
origin ending with `/api/connected-oauth`. Register the three callback URLs
with the identity providers. Public callbacks **must** use HTTPS.

The source encryption key `GMAIL_TOKEN_ENCRYPTION_KEY` must remain stable and
private. Existing source tokens can be replaced by OAuth connections from the
Sources UI. Disconnect removes stored credentials in Atlas; revoke grants at
the provider separately.

## Linear and Jira

Linear continues to use its authorized read-only API token or OAuth access
token. Jira requires `ATLAS_JIRA_BASE_URL=https://TENANT.atlassian.net`
with an appropriately scoped OAuth bearer token. Basic-auth API tokens are
not supported.

## Known limits

OAuth credentials are refreshed and rotated when a source is accessed, but
there is no background sync, exhaustive pagination, provider-specific audit
dashboard, or production consent verification in this branch. External API
access and OAuth flows require live credential testing. Read-only API requests
have bounded retry on transient upstream failures.

Run `PYTHONPATH=backend pytest backend/tests -q` and
`cd frontend && npm run typecheck && npm run build`.
