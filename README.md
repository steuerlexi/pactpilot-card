# PactPilot Card

Custom Lovelace card for Home Assistant — manage contracts and subscriptions directly in your dashboard.

## Features

- 📋 Grid view with contract tiles (logo, name, provider, cost, cycle, due date)
- 🔍 Category filtering (Insurance, Streaming, Cloud, Housing, etc.)
- 📄 Detail view with markdown-formatted contract details
- ✏️ Full CRUD — create, edit, and delete contracts from the dashboard
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
details: |
  ## Coverage
  - Full comprehensive
  - Liability 100M €
status: active
```

## License

MIT
