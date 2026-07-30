# PactPilot Card

Custom Lovelace card for Home Assistant — manage contracts and subscriptions directly in your dashboard.

## Features

- 📋 Grid view with contract tiles (logo, name, provider, cost, cycle, due date)
- 🔍 Category filtering (Insurance, Streaming, Cloud, Housing, etc.)
- 📄 Detail view with markdown-formatted contract details
- ✏️ Full CRUD — create, edit, and delete contracts from the dashboard
- 🔗 Clickable **URL** field per contract (opens provider page)
- 📝 Long contract details stored via AppDaemon in a sensor attribute (bypasses the 255-char state limit)
- 🖱 Reliable click handling with composed-path routing and render deduplication
- 🎨 Logo supports all Home Assistant icon packs (`mdi:`, `hue:`, `custom:`, …) plus image URLs
- 🌐 German + English (auto-detected via HA locale)
- 🎨 Dark mode support
- 🤖 Each contract is a `sensor.pactpilot_*` entity — usable in automations

## Installation

### HACS (recommended)

1. Add this repository to HACS as a custom repository
2. Install "PactPilot Card"
3. Add the resource: HACS → PactPilot Card → Add to Lovelace

### Manual

1. Copy `pactpilot-card.js` to `/config/www/pactpilot-card.js`
2. Add Lovelace resource: `/local/pactpilot-card.js` (type: JavaScript Module)

### Required: AppDaemon backend

PactPilot needs one-time AppDaemon setup because Home Assistant's entity `state` is limited to 255 characters. The card stores **all** contract data in a single sensor per contract, with the long Markdown details living in an attribute.

1. Install the **AppDaemon 4** add-on from the Home Assistant add-on store.
2. Copy `apps/pactpilot_backend.py` to your AppDaemon `apps/` folder
   (usually `/config/appdaemon/apps/` or `/config/addons_config/a0d7b954_appdaemon/apps/`).
3. Register the app in `apps.yaml`:
   ```yaml
   pactpilot_backend:
     module: pactpilot_backend
     class: PactPilotBackend
   ```
4. Restart AppDaemon.

AppDaemon will then create sensors like `sensor.pactpilot_<contract>` with all contract data in attributes and the long Markdown stored in the `markdown` attribute.

## Configuration

```yaml
type: custom:pactpilot-card
# All fields below are optional:
categories: []       # Custom categories (overrides defaults)
```

Contracts are auto-discovered — any `sensor.pactpilot_*` entity with a `name` attribute is shown.

## Creating Contracts

Click **＋ Neu** in the card header. Fill in the form and save. The card fires an event that the AppDaemon backend turns into a sensor.

## Automation Example

```yaml
alias: "PactPilot — Payment Due Warning"
trigger:
  - platform: template
    value_template: >
      {% for e in states.sensor
           | selectattr('entity_id', 'search', 'sensor.pactpilot_') %}
        {% set np = e.attributes.next_payment %}
        {% if np and (np | as_datetime - now()).days == 3 %}
          true
        {% endif %}
      {% endfor %}
action:
  - service: notify.notify
    data:
      message: "⚠️ A contract payment is due in 3 days"
```

## Data Format

Each contract is stored as one sensor entity:

| Sensor | Example |
|--------|---------|
| Entity | `sensor.pactpilot_netflix` |
| State | `active` (status) |
| `name` | Netflix |
| `category` | Streaming |
| `provider` | Netflix Inc. |
| `cost` | 12.99 |
| `cycle` | monatlich |
| `next_payment` | 2026-08-15 |
| `logo` | mdi:television |
| `url` | https://netflix.com/manage |
| `markdown` | long Markdown details |

## License

MIT
