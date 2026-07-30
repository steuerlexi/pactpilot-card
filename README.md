# PactPilot Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![License](https://img.shields.io/github/license/steuerlexi/pactpilot-card.svg?style=for-the-badge)](LICENSE)

A Home Assistant Lovelace custom card for managing contracts and subscriptions.

---

## Installation

### HACS (Recommended)

1. Open HACS → **Frontend** → **Custom repositories**
2. Add repository: `https://github.com/steuerlexi/pactpilot-card`
   - Category: **Lovelace**
3. Click **Download** on the PactPilot Card entry
4. Refresh your browser cache (Ctrl+Shift+R)

### Manual

1. Copy `pactpilot-card.js` to `/config/www/`
2. Add to Lovelace resources:
   ```yaml
   url: /local/pactpilot-card.js
   type: module
   ```

---

## License

MIT
