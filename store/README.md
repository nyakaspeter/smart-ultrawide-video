# Chrome Web Store release files

- `LISTING.md`: copy for the Store Listing tab
- `PRIVACY-ANSWERS.md`: privacy and permission declarations
- `REVIEWER-INSTRUCTIONS.md`: reviewer test instructions
- `SUBMISSION-CHECKLIST.md`: dashboard and release checklist
- `assets/`: upload-ready screenshots and promotional graphics
- `source/`: HTML/CSS used to render the graphics

The privacy-policy source is [`../PRIVACY.md`](../PRIVACY.md). Host it at a
stable public HTTPS URL before submitting the extension.

Required release checks:

```sh
pnpm typecheck
pnpm test
pnpm zip
```
