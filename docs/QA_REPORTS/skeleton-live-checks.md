# Trial deploy: live checks on the protected preview

Measured 13–14 Nov 2026 (Toronto time) on the protected preview of this branch. Every number is a live measurement from the build machine unless marked as an estimate. Protection stayed on throughout. Raw logs and the scripts that produced them are in the `skeleton-live-evidence` folder next to this file.

## How we got in
We used the Vercel command-line tool, signed in as the owner, and its built-in "curl" command. The first time it ran (13 Nov, 11:42 PM), it created one project-level "protection bypass for automation" secret. That secret was also used for the headless-browser screenshots and the rate-limit bursts. It is never written to the repository, logs or reports. Deployment protection itself was not changed.

## 1. One project serves the website and the data service: met
Website home page: 200, 10,879 bytes. Health check: 200. Metadata: 200. All three came from the same preview address, n=1 each, at 11:42 PM. All ten pages, five on desktop and five on mobile, also returned 200 in the headless browser (screenshots in `skeleton-live-screenshots`).

## 2. Data service bundle under 500 MB: met
Vercel reports the deployed data-service function at 6,479,971 bytes (about 6.5 MB). Vercel does not say whether this figure is compressed. The uncompressed size from a local build is 11,081,986 bytes (estimate). Either way, it is far below 500 MB.

## 3. Cold start: see the section below (in progress at the time of writing)

## 4. Responses under 256 KB: met
Health is 36 bytes and metadata is 422 bytes. The home page HTML is 10,879 bytes. These are the only endpoints the skeleton has, and their sizes are fixed.

## 5. Caching and rate limit: met
- **Caching:** the first metadata request in a window was a MISS. Three repeats were each a HIT (age 20 to 25 s). A new query string was a MISS, and repeating it was a HIT. A second new query string was a MISS. Health is never cached (no-store, MISS on both requests). Vercel shows browsers `public, max-age=0` for metadata; it keeps the shared-cache part of the header for itself, which matches the HITs.
- **Rate limit:** the project now has one free firewall rule. Requests whose path starts with /api/ are limited to 300 per 60 seconds per IP address, and anything over that gets a 429.
  - A burst of 330 requests at the 300 limit got no 429s. The build machine's internet traffic leaves from several rotating addresses (the firewall's traffic view shows at least five), so no single address went over 300.
  - To prove the rule works, we lowered it to 20 per 60 seconds for about 30 seconds and sent 120 requests. 52 came back 429 and 68 came back 200, while the website stayed at 200. We then set the limit back to 300, and the live configuration confirms it.
  - An earlier attempt to lower the limit with a simpler command did not take effect: Vercel reported "no changes", and all 120 requests got 200. It is recorded in the log.
