# Chrome Web Store privacy answers

Use these answers as a guide when completing the Privacy practices tab. Match
the wording to the dashboard fields presented at submission time.

## Single purpose

Detect black bars in fullscreen HTML5 videos and scale the video to make better
use of the available display area.

## Permission justifications

### Storage

Stores the user's enabled state, frame-analysis frequency, zoom-change
tolerance, zoom-out delay, and animation preference locally in the browser.

### Host access: HTTP and HTTPS websites

The extension must inspect and style the active fullscreen HTML5 video on the
website where the user starts playback. It supports video websites generally,
so it requires access to HTTP and HTTPS pages. Frame analysis and visual changes
occur only while the extension is enabled and a video is fullscreen.

## Remote code

No. The extension does not load or execute remote code. All executable code is
included in the extension package.

## Data-use disclosure

Disclose **Website content** because the extension temporarily processes a
small sample of fullscreen video-frame pixels locally to detect black bars.

The frame samples:

- are used only for the extension's single user-facing purpose;
- remain on the user's device;
- are held only in memory for the current analysis;
- are not retained, logged, transmitted, sold, or shared;
- are not used for advertising, credit decisions, or unrelated purposes;
- are not made available for human review.

The extension does not collect browsing history, URLs, personal identifiers,
authentication information, communications, location, financial information,
or health information.

## Privacy policy URL

Publish the repository's `PRIVACY.md` at a stable public HTTPS URL and paste
that URL into the dashboard. A GitHub repository page or GitHub Pages site is
sufficient if it remains publicly accessible.
