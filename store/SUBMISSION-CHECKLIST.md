# Chrome Web Store submission checklist

## Publisher account

- [ ] Register the intended long-term Google account as a Chrome Web Store developer.
- [ ] Pay the one-time registration fee.
- [ ] Enable two-step verification.
- [ ] Verify the developer contact email.
- [ ] Choose the publisher name.
- [ ] Complete the trader or non-trader declaration accurately.

## Public URLs

- [ ] Host `PRIVACY.md` at a stable public HTTPS URL.
- [ ] Provide a support URL or support email in the dashboard.
- [ ] Optionally provide a project homepage.

## Package and listing

- [ ] Run `pnpm typecheck`, `pnpm test`, and `pnpm zip`.
- [ ] Upload `.output/smart-ultrawide-video-1.0.0-chrome.zip`.
- [ ] Copy the name, summary, category, and description from `LISTING.md`.
- [ ] Upload `assets/01-smart-fill.png` and `assets/02-controls.png` as screenshots.
- [ ] Upload `assets/small-promo-440x280.png` as the small promotional tile.
- [ ] Complete the Privacy practices tab using `PRIVACY-ANSWERS.md`.
- [ ] Paste the public privacy-policy URL into the Privacy practices tab.
- [ ] Paste `REVIEWER-INSTRUCTIONS.md` into the Test instructions tab where applicable.
- [ ] Select Public distribution and the desired countries.
- [ ] Consider deferred publishing so approval does not immediately release the item.

## Final verification

- [ ] Extract the exact ZIP, load the extracted folder as an unpacked extension, and test the popup.
- [ ] Test fullscreen entry, exit, viewport resize, autoplay to a new video, and the keyboard shortcut.
- [ ] Confirm the extension requests only storage plus HTTP/HTTPS host access.
- [ ] Confirm no developer placeholders remain in dashboard text or URLs.
