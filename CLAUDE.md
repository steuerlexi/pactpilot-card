# PactPilot Card

Custom Lovelace card for Home Assistant — contract & subscription manager.
Single-file JavaScript, no build step. Deployed via GitHub → HACS.

## Structure
- `pactpilot-card.js` — the card (only source file)
- `hacs.json` — HACS metadata
- `.github/workflows/validate.yml` — HACS CI

## Development
Edit `pactpilot-card.js`, test in HA dashboard.
No npm, no bundler, no dependencies.
