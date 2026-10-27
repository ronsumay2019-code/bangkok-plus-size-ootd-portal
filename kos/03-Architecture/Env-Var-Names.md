# Env var names (names only, never values)

Values are kept in Vercel → Project Settings → Environment Variables. Never put them here, in the repo or in chat.

| Name | Used for |
|---|---|
| `META_PAGE_ACCESS_TOKEN` | Facebook Page token (Graph API, Messenger send) |
| `META_PAGE_ID` | Facebook Page id |
| `META_APP_SECRET` | Webhook signature check (**not set**, KI-008) |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta webhook verification |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | Server-side database access |
| `PORTAL_OWNER_CODE` | Owner sign-in seed |
| `GEMINI_API_KEY` | Optional AI features |
| `BRIDGE_SYNC_URL`, `FB_LIVE_VIDEO_ID` | Legacy; to be reviewed |

**Clean-up ticket (W5).** The server also accepts several old alias names for the same token and page id:
- `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FB_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `FB_TOKEN`, `META_ACCESS_TOKEN`, `META_TOKEN`, `PAGE_ACCESS_TOKEN`;
- `FACEBOOK_PAGE_ID`, `FB_PAGE_ID`, `PAGE_ID`.

Reduce these to one name each, so the token can only come from one place.
