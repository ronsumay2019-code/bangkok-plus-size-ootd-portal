# R-004 · Grok review of RP-004 (tonight's capture release), 26 Oct

Pasted by the owner. Summary of Grok's words; the full text is in the session chat of 26 Oct.

**Verdict: CHANGES NEEDED**

| # | Sev | Finding (Grok) | Grok's fix |
|---|---|---|---|
| 1 | High | Lost update on `transcripts`: two server copies can both pass the in-memory 3-minute check, read the same kept lines, merge and write; the last write drops the other's new lines. After the live Facebook keeps only the first minute, so a dropped line is gone for good. | Serialize read-merge-write, or a version check and retry |
| 2 | High | A webhook comment is not kept in `raw_comments` when its live is not linked yet (`liveForComment` returns null). The rule is keep every live comment as written. | Always keep it, with a null live and link it later |
| 3 | High | A later Graph read without a name overwrites the name a webhook kept (the upsert replaces the whole record). | Keep a non-empty earlier name |
| 4 | Medium | Token redaction is a string replace after JSON.stringify; a token with characters JSON escapes would slip through. | Redact before stringify; strip `access_token=` values |
| 5 | Medium | Replay job: a 5-hour video on Groq's free tier may pass the 340-minute limit with nothing saved (writes only at the end); any push of the request file starts it; download has no cap. | Checkpoint each piece; explicit trigger; cap the download |
| 6 | Low | `getRecord` with odd ids (commas, quotes, Unicode) could return nothing. | Restrict ids to digits or add a round-trip test |

**What Grok tried and could not break:** anonymous access (policies dropped), a state save deleting `raw_comments` or `transcripts`, the Groq key in any response, duplicate caption lines, the webhook order path.

**Grok's owner questions:** (1) keep a comment that arrives before its live is linked? (2) is a 5-hour video expected, and is the Groq key free or paid?
