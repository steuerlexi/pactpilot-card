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
        contracts_zero: 'Keine Verträge',
        contracts_one: '1 Vertrag',
        contracts: 'Verträge',
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
        contracts_zero: 'No contracts',
        contracts_one: '1 contract',
        contracts: 'contracts',
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
      const data = this._parseYaml(stateObj.state);
      if (!data || !data.name) continue;
      contracts.push({
        entity_id: entityId,
        ...data,
        cost: parseFloat(data.cost) || 0
      });
    }
    // Sort: active first, then pending, then cancelled; then by next_payment date; then by name
    const STATUS_ORDER = { active: 0, pending: 1, cancelled: 2 };
    contracts.sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
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

  _getStyles() {
    return `
      <style>
        .pp-card {
          font-family: var(--paper-font-body1, Roboto, sans-serif);
          color: var(--primary-text-color, #212121);
          padding: 16px;
        }
        .pp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .pp-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .pp-add-btn {
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
          border: none;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: opacity 0.15s;
        }
        .pp-add-btn:hover { opacity: 0.85; }
        .pp-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .pp-pill {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
          color: var(--secondary-text-color, #727272);
          transition: all 0.15s;
        }
        .pp-pill.active {
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color, #03a9f4);
        }
        .pp-pill:hover:not(.active) {
          background: var(--secondary-background-color, #f5f5f5);
        }
        .pp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
          gap: 10px;
        }
        .pp-tile {
          background: var(--card-background-color, #fff);
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 10px;
          padding: 14px 12px;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }
        .pp-tile:hover {
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.12));
        }
        .pp-tile-logo {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 8px;
          background: var(--secondary-background-color, #f5f5f5);
        }
        .pp-tile-logo img {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .pp-tile-name {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pp-tile-provider {
          font-size: 11px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 6px;
        }
        .pp-tile-cost {
          font-size: 15px;
          font-weight: 700;
          color: var(--primary-color, #03a9f4);
        }
        .pp-tile-cycle {
          font-size: 10px;
          color: var(--secondary-text-color, #727272);
        }
        .pp-tile-date {
          font-size: 10px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
        }
        .pp-status-dot {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .pp-status-dot.active { background: #4caf50; }
        .pp-status-dot.cancelled { background: #f44336; }
        .pp-status-dot.pending { background: #ff9800; }
        .pp-summary {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,0.08));
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
        }
        .pp-summary strong { color: var(--primary-text-color, #212121); }
        .pp-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--secondary-text-color, #727272);
        }
        .pp-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
      </style>
    `;
  }

  _getCategoryIcon(categoryId) {
    const cat = PactPilotCard.CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat.icon : 'mdi:dots-horizontal';
  }

  _getCategoryColor(categoryId) {
    const cat = PactPilotCard.CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat.color : '#9e9e9e';
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(this._hass?.locale?.language === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  _computeMonthlyCost(contract) {
    const cost = parseFloat(contract.cost) || 0;
    switch (contract.cycle) {
      case 'jährlich': return cost / 12;
      case 'vierteljährlich': return cost / 3;
      case 'halbjährlich': return cost / 6;
      default: return cost; // monatlich
    }
  }

  _render(view = 'grid', selectedContract = null) {
    if (!this._hass) return;
    this._rendered = true;
    this._currentView = view;
    this._selectedContract = selectedContract;
    this._activeCategory = this._activeCategory || 'Alle';

    const contracts = this._getContracts();
    const filtered = this._activeCategory === 'Alle'
      ? contracts
      : contracts.filter(c => c.category === this._activeCategory);

    const activeCount = contracts.filter(c => c.status === 'active').length;
    const cancelledCount = contracts.filter(c => c.status === 'cancelled').length;
    const monthlyTotal = contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + this._computeMonthlyCost(c), 0);

    const categories = ['Alle', ...PactPilotCard.CATEGORIES.map(c => c.id)];

    let html = this._getStyles();

    html += `<div class="pp-card">
      <div class="pp-header">
        <h3>${this._t('title')}</h3>
        <button class="pp-add-btn" id="pp-add-btn">${this._t('new')}</button>
      </div>

      <div class="pp-pills">
        ${categories.map(cat => {
          const count = cat === 'Alle' ? contracts.length : contracts.filter(c => c.category === cat).length;
          const icon = cat === 'Alle' ? '' : this._getCategoryIcon(cat);
          return `<span class="pp-pill${this._activeCategory === cat ? ' active' : ''}"
            data-category="${cat}">${icon ? `<ha-icon icon="${icon}" style="width:14px;height:14px;margin-right:2px;vertical-align:-2px"></ha-icon>` : ''}${cat} (${count})</span>`;
        }).join('')}
      </div>`;

    if (filtered.length === 0) {
      html += `<div class="pp-empty">
        <div class="pp-empty-icon">📋</div>
        <p>${this._t('all') === 'Alle' ? 'Keine Verträge gefunden' : 'No contracts found'}</p>
      </div>`;
    } else {
      html += `<div class="pp-grid">
        ${filtered.map(c => `
          <div class="pp-tile" data-entity="${c.entity_id}">
            <div class="pp-status-dot ${c.status}"></div>
            <div class="pp-tile-logo">
              ${c.logo && c.logo.startsWith('mdi:')
                ? `<ha-icon icon="${c.logo}" style="color:${this._getCategoryColor(c.category)}"></ha-icon>`
                : c.logo && (c.logo.startsWith('http') || c.logo.startsWith('/'))
                  ? `<img src="${c.logo}" alt="${c.name}" onerror="this.parentElement.innerHTML='<ha-icon icon=\\'${this._getCategoryIcon(c.category)}\\' style=\\'color:${this._getCategoryColor(c.category)}\\'></ha-icon>'">`
                  : `<ha-icon icon="${this._getCategoryIcon(c.category)}" style="color:${this._getCategoryColor(c.category)}"></ha-icon>`
              }
            </div>
            <div class="pp-tile-name">${c.name}</div>
            <div class="pp-tile-provider">${c.provider || ''}</div>
            <div class="pp-tile-cost">${c.cost.toFixed(2).replace('.', ',')} €</div>
            <div class="pp-tile-cycle">${this._cycleLabel(c.cycle)}</div>
            ${c.next_payment ? `<div class="pp-tile-date">⏰ ${this._formatDate(c.next_payment)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }

    html += `<div class="pp-summary">
      <span>🟢 <strong>${activeCount}</strong> ${this._t('active')}</span>
      <span>🔴 <strong>${cancelledCount}</strong> ${this._t('cancelled')}</span>
      <span>💰 <strong>${monthlyTotal.toFixed(2).replace('.', ',')} €</strong> ${this._t('monthly_total')}</span>
    </div>`;

    html += `</div>`;
    this.innerHTML = html;
    this._bindEvents();
  }

  _bindEvents() {
    // Category pill clicks
    this.querySelectorAll('.pp-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        this._activeCategory = e.currentTarget.dataset.category;
        this._render('grid');
      });
    });

    // Tile clicks → detail view (stub for now)
    this.querySelectorAll('.pp-tile').forEach(tile => {
      tile.addEventListener('click', (e) => {
        const entityId = e.currentTarget.dataset.entity;
        const contract = this._getContracts().find(c => c.entity_id === entityId);
        if (contract) this._render('detail', contract);
      });
    });

    // Add button (stub for now)
    const addBtn = this.querySelector('#pp-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this._render('form'));
    }
  }
}

customElements.define('pactpilot-card', PactPilotCard);
