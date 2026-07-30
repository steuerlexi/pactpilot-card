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
- 🤖 Each contract is an `input_text` entity — usable in automations

## Installation

### HACS (recommended)

1. Add this repository to HACS as a custom repository
2. Install "PactPilot Card"
3. Add the resource: HACS → PactPilot Card → Add to Lovelace

### Manual

1. Copy `pactpilot-card.js` to `/config/www/pactpilot-card.js`
2. Add Lovelace resource: `/local/pactpilot-card.js` (type: JavaScript Module)

### Required: AppDaemon backend for long details

Long Markdown details need one-time setup because Home Assistant's `state` field is limited to 255 characters.

1. Install the **AppDaemon 4** add-on from the Home Assistant add-on store.
2. Copy `apps/pactpilot_details.py` to your AppDaemon `apps/` folder
   (usually `/config/appdaemon/apps/` or `/config/addons_config/a0d7b954_appdaemon/apps/`).
3. Register the app in `apps.yaml`:
   ```yaml
   pactpilot_details:
     module: pactpilot_details
     class: PactPilotDetails
   ```
4. Restart AppDaemon.

AppDaemon will then create sensors like `sensor.pactpilot_<contract>_details`
with the long Markdown stored in the `markdown` attribute.

## Configuration

```yaml
type: custom:pactpilot-card
# All fields below are optional:
categories: []       # Custom categories (overrides defaults)
default_view: grid   # "grid" (default)
```

Contracts are auto-discovered — any `input_text` helper with label `pactpilot` is shown.

## Creating Contracts

Click **＋ Neu** in the card header. Fill in the form and save. The card creates an `input_text` helper with your contract data as YAML.

## Automation Example

```yaml
alias: "PactPilot — Payment Due Warning"
trigger:
  - platform: template
    value_template: >
      {% for e in states.input_text
           | selectattr('entity_id', 'search', 'input_text.pactpilot_') %}
        {% set data = e.state | from_yaml %}
        {% if data.next_payment
              and (data.next_payment | as_datetime - now()).days == 3 %}
          true
        {% endif %}
      {% endfor %}
action:
  - service: notify.notify
    data:
      message: "⚠️ A contract payment is due in 3 days"
```

## Data Format

Each contract is stored as YAML in an `input_text` entity:

```yaml
name: HUK Car Insurance
category: Versicherung
provider: HUK24
cost: 45.00
cycle: jährlich
next_payment: "2026-12-01"
logo: mdi:car
url: https://huk24.de
status: active

# Details are stored by AppDaemon in:
# sensor.pactpilot_<name>_details
# attribute: markdown
```

## License

MIT
