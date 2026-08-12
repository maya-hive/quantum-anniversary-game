---
name: Campaign export path
description: How campaign results should remain usable when the optional Google Sheets connection is unavailable.
---

The campaign should remain fully playable without a Google Sheets authorization. Keep the export record complete enough to hand off later: player name, email, phone, all three shot rewards, best reward, and timestamp.

**Why:** The Google Sheets connection was optional and was not authorized during the initial build, so silently dropping campaign data would make the experience incomplete.

**How to apply:** If Google Sheets is connected in a later pass, preserve the same fields and keep the CSV download as a resilient fallback.