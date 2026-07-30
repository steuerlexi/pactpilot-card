class PactPilotCard extends HTMLElement {
  constructor() {
    super();
  }

  setConfig(config) {
    this.config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }

  // i18n: German (default) + English fallback
  static get I18N() {
    return {
      de: {
        title: 'Verträge & Abos',
        new: '＋ Neu',
        all: 'Alle',
        active: 'aktiv',
        cancelled: 'gekündigt',
        pending: 'ausstehend',
        monthly_total: '/Monat',
        back: '← Zurück',
        edit: '✏️ Bearbeiten',
        delete: '🗑 Löschen',
        save: '💾 Speichern',
        cancel: 'Abbrechen',
        confirm_delete: 'Wirklich löschen?',
        details_label: 'Vertragsdetails',
        cost: 'Kosten',
        cycle: 'Zyklus',
        next_payment: 'Nächste Fälligkeit',
        category_label: 'Kategorie',
        provider: 'Anbieter',
        logo: 'Logo / Icon',
        name: 'Name',
        status: 'Status',
        cycles: {
          monatlich: 'monatlich',
          vierteljährlich: 'vierteljährlich',
          halbjährlich: 'halbjährlich',
          jährlich: 'jährlich'
        }
      },
      en: {
        title: 'Contracts & Subscriptions',
        new: '＋ New',
        all: 'All',
        active: 'active',
        cancelled: 'cancelled',
        pending: 'pending',
        monthly_total: '/month',
        back: '← Back',
        edit: '✏️ Edit',
        delete: '🗑 Delete',
        save: '💾 Save',
        cancel: 'Cancel',
        confirm_delete: 'Really delete?',
        details_label: 'Contract Details',
        cost: 'Cost',
        cycle: 'Cycle',
        next_payment: 'Next Payment',
        category_label: 'Category',
        provider: 'Provider',
        logo: 'Logo / Icon',
        name: 'Name',
        status: 'Status',
        cycles: {
          monatlich: 'monthly',
          vierteljährlich: 'quarterly',
          halbjährlich: 'semi-annually',
          jährlich: 'annually'
        }
      }
    };
  }

  static get CATEGORIES() {
    return [
      { id: 'Versicherung', icon: 'mdi:shield-check', color: '#4caf50' },
      { id: 'Streaming', icon: 'mdi:television', color: '#e91e63' },
      { id: 'Cloud & IT', icon: 'mdi:cloud', color: '#2196f3' },
      { id: 'Wohnen', icon: 'mdi:home', color: '#ff9800' },
      { id: 'Mobilität', icon: 'mdi:car', color: '#795548' },
      { id: 'Finanzen', icon: 'mdi:bank', color: '#9c27b0' },
      { id: 'Abo', icon: 'mdi:package-variant', color: '#607d8b' },
      { id: 'Sonstiges', icon: 'mdi:dots-horizontal', color: '#9e9e9e' }
    ];
  }

  _t(key) {
    const lang = (this._hass && this._hass.locale && this._hass.locale.language === 'de') ? 'de' : 'en';
    return PactPilotCard.I18N[lang][key] || key;
  }

  _cycleLabel(cycle) {
    const lang = (this._hass && this._hass.locale && this._hass.locale.language === 'de') ? 'de' : 'en';
    return PactPilotCard.I18N[lang].cycles[cycle] || cycle;
  }

  _statusLabel(status) {
    return this._t(status);
  }

  _getContracts() {
    if (!this._hass) return [];
    const contracts = [];
    for (const [entityId, stateObj] of Object.entries(this._hass.states)) {
      if (!entityId.startsWith('input_text.pactpilot_')) continue;
      // Check for pactpilot label
      const labels = stateObj.attributes?.labels || [];
      // Also accept entities that match the naming pattern even without label
      const data = this._parseYaml(stateObj.state);
      if (!data || !data.name) continue;
      contracts.push({
        entity_id: entityId,
        ...data,
        cost: parseFloat(data.cost) || 0
      });
    }
    // Sort: active first, then by next_payment date
    contracts.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : a.status === 'pending' ? 0 : 1;
      }
      if (a.next_payment && b.next_payment) {
        return new Date(a.next_payment) - new Date(b.next_payment);
      }
      return a.name.localeCompare(b.name);
    });
    return contracts;
  }

  _parseYaml(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      // Simple YAML parser for our flat structure
      const result = {};
      const lines = str.split('\n');
      let currentKey = null;
      let multilineValue = [];
      let inMultiline = false;

      for (const line of lines) {
        if (inMultiline) {
          if (line.startsWith('  ') || line.startsWith('\t') || line === '') {
            multilineValue.push(line.replace(/^  /, ''));
            continue;
          } else {
            result[currentKey] = multilineValue.join('\n').trim();
            multilineValue = [];
            inMultiline = false;
            currentKey = null;
          }
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && !inMultiline) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          if (value === '|' || value === '|-' || value === '>') {
            currentKey = key;
            multilineValue = [];
            inMultiline = true;
          } else {
            result[key] = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
          }
        }
      }
      if (inMultiline && currentKey) {
        result[currentKey] = multilineValue.join('\n').trim();
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  _slugify(name) {
    return name
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  _render() {
    if (!this._hass) return;
    this._rendered = true;
    const contracts = this._getContracts();
    this.innerHTML = `<ha-card>
      <div class="card-content">
        <h3>${this._t('title')}</h3>
        <p>${contracts.length} ${contracts.length === 1 ? 'Vertrag' : 'Verträge'}</p>
      </div>
    </ha-card>`;
  }
}

customElements.define('pactpilot-card', PactPilotCard);
