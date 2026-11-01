# Additional read-only source connectors

New providers: **Google Calendar, Linear, Jira, OneDrive, and Outlook**.
These providers appear under Sources and can be selected in Ask Atlas.
The existing workspace-scoped ExternalConnection table stores encrypted
credentials: **no schema migration** is introduced.

## First batch limitations

This version uses manually supplied provider access tokens, NOT production-ready
OAuth consent or refresh workflows. All connectors are read-only. Atlas does
not background-sync these providers. Calendar and Microsoft Graph access tokens
are short-lived and must be replaced when they expire.

- **Google Calendar:** a Google OAuth access token with `calendar.events.readonly`
  and, for the initial account profile check, `calendar.calendarlist.readonly`.
  Queries search primary-calendar event summaries/descriptions; this is not a
  calendar-wide semantic index.
- **Linear:** an authorized Linear personal API key or OAuth token with read access
  to issues. The adapter uses Linear's GraphQL API.
- **Jira:** set `ATLAS_JIRA_BASE_URL=https://YOUR-TENANT.atlassian.net`
  on the server. Use an OAuth access token with permission to read issues.
  Jira API tokens used with HTTP Basic authentication are not supported.
- **OneDrive:** a Microsoft Graph delegated access token with
  `Files.Read` (or `Files.Read.All` where required). Searches the user's
  default drive metadata; it does not download document bodies or search all
  SharePoint sites.
- **Outlook:** a Microsoft Graph delegated access token with `Mail.Read`.
  Searches mailbox message metadata and body previews (not full messages).

All accounts must grant permissions themselves. Provider permission checks
are enforced upstream as well as by Atlas's workspace access control.

## Production requirements

Add official OAuth authorization-code flows, refresh-token rotation,
token expiry/revocation handling, provider rate-limit backoff, pagination,
audit logging, and consent/permission UX before treating this batch as
production-ready. Avoid pasting secrets into issues, logs or screenshots.

Run: `PYTHONPATH=backend pytest backend/tests -q`;
`cd frontend && npm run typecheck && npm run build`.
