class PactPilotCard extends HTMLElement {
  constructor() {
    super();
  }

  setConfig(config) {
    this.config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
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
        empty_title: 'Keine Verträge gefunden',
        empty_subtitle: 'In dieser Kategorie gibt es keine Einträge.',
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
        empty_title: 'No contracts found',
        empty_subtitle: 'There are no entries in this category.',
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

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
        .pp-back {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          cursor: pointer;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pp-back:hover { color: var(--primary-text-color, #212121); }
        .pp-hero {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
        }
        .pp-hero-logo {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--secondary-background-color, #f5f5f5);
          flex-shrink: 0;
        }
        .pp-hero-info h3 { margin: 0 0 2px 0; font-size: 18px; font-weight: 600; }
        .pp-hero-provider { font-size: 13px; color: var(--secondary-text-color, #727272); }
        .pp-status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          margin-top: 4px;
        }
        .pp-status-badge.active { background: rgba(76,175,80,0.15); color: #4caf50; }
        .pp-status-badge.cancelled { background: rgba(244,67,54,0.15); color: #f44336; }
        .pp-status-badge.pending { background: rgba(255,152,0,0.15); color: #ff9800; }
        .pp-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }
        .pp-meta-item {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .pp-meta-label {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--secondary-text-color, #727272);
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .pp-meta-value { font-size: 15px; font-weight: 600; }
        .pp-meta-value.price { color: var(--primary-color, #03a9f4); }
        .pp-details {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        .pp-details h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          text-transform: uppercase;
          color: var(--secondary-text-color, #727272);
          letter-spacing: 0.5px;
        }
        .pp-markdown { font-size: 13px; line-height: 1.6; }
        .pp-markdown h5 { font-size: 12px; color: var(--secondary-text-color, #727272); margin: 10px 0 4px 0; }
        .pp-markdown ul { margin: 4px 0; padding-left: 18px; }
        .pp-markdown li { margin: 2px 0; font-size: 12px; }
        .pp-markdown code { background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
        .pp-markdown a { color: var(--primary-color, #03a9f4); }
        .pp-actions { display: flex; gap: 8px; }
        .pp-btn {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }
        .pp-btn:hover { background: var(--secondary-background-color, #f5f5f5); }
        .pp-btn.primary { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); border-color: transparent; }
        .pp-btn.primary:hover { opacity: 0.85; }
        .pp-btn.danger { color: #f44336; border-color: rgba(244,67,54,0.3); }
        .pp-btn.danger:hover { background: rgba(244,67,54,0.08); }
        .pp-form { }
        .pp-field { margin-bottom: 12px; }
        .pp-field label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--secondary-text-color, #727272);
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .pp-field input, .pp-field select, .pp-field textarea {
          width: 100%;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 13px;
          font-family: inherit;
          box-sizing: border-box;
        }
        .pp-field textarea {
          min-height: 100px;
          resize: vertical;
          font-family: 'SF Mono', 'Fira Code', 'Roboto Mono', monospace;
          font-size: 12px;
          line-height: 1.5;
        }
        .pp-row { display: flex; gap: 10px; }
        .pp-row .pp-field { flex: 1; }
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
  _renderMarkdown(md) {
    if (!md || typeof md !== 'string') return '';
    let html = md
      // Headings
      .replace(/^### (.+)$/gm, '<h5>$1</h5>')
      .replace(/^## (.+)$/gm, '<h4>$1</h4>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap list items
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      if (!match.includes('<ul>')) return `<ul>${match}</ul>`;
      return match;
    });

    return `<p>${html}</p>`;
  }

  _renderDetail(contract) {
    let html = this._getStyles();

    html += `<div class="pp-card">
      <div class="pp-back" id="pp-back-btn">${this._t('back')}</div>

      <div class="pp-hero">
        <div class="pp-hero-logo">
          ${contract.logo && contract.logo.startsWith('mdi:')
            ? `<ha-icon icon="${contract.logo}" style="color:${this._getCategoryColor(contract.category)};--mdc-icon-size:32px"></ha-icon>`
            : contract.logo && (contract.logo.startsWith('http') || contract.logo.startsWith('/'))
              ? `<img src="${contract.logo}" alt="${contract.name}" style="width:48px;height:48px;object-fit:contain" onerror="this.style.display='none'">`
              : `<ha-icon icon="${this._getCategoryIcon(contract.category)}" style="color:${this._getCategoryColor(contract.category)};--mdc-icon-size:32px"></ha-icon>`
          }
        </div>
        <div class="pp-hero-info">
          <h3>${contract.name}</h3>
          <div class="pp-hero-provider">${contract.provider || ''}</div>
          <span class="pp-status-badge ${contract.status}">${this._statusLabel(contract.status)}</span>
        </div>
      </div>

      <div class="pp-meta">
        <div class="pp-meta-item">
          <div class="pp-meta-label">${this._t('cost')}</div>
          <div class="pp-meta-value price">${contract.cost.toFixed(2).replace('.', ',')} €</div>
        </div>
        <div class="pp-meta-item">
          <div class="pp-meta-label">${this._t('cycle')}</div>
          <div class="pp-meta-value">${this._cycleLabel(contract.cycle)}</div>
        </div>
        <div class="pp-meta-item">
          <div class="pp-meta-label">${this._t('next_payment')}</div>
          <div class="pp-meta-value">${contract.next_payment ? this._formatDate(contract.next_payment) : '—'}</div>
        </div>
        <div class="pp-meta-item">
          <div class="pp-meta-label">${this._t('category_label')}</div>
          <div class="pp-meta-value">
            <ha-icon icon="${this._getCategoryIcon(contract.category)}" style="width:16px;height:16px;margin-right:4px;vertical-align:-3px;color:${this._getCategoryColor(contract.category)}"></ha-icon>
            ${contract.category}
          </div>
        </div>
      </div>`;

    if (contract.details) {
      html += `<div class="pp-details">
        <h4>${this._t('details_label')}</h4>
        <div class="pp-markdown">${this._renderMarkdown(contract.details)}</div>
      </div>`;
    }

    html += `<div class="pp-actions">
      <button class="pp-btn primary" id="pp-edit-btn">${this._t('edit')}</button>
      <button class="pp-btn danger" id="pp-delete-btn">${this._t('delete')}</button>
    </div>`;

    html += `</div>`;
    this.innerHTML = html;
    this._bindDetailEvents(contract);
  }

  _bindDetailEvents(contract) {
    this.querySelector('#pp-back-btn')?.addEventListener('click', () => this._render('grid'));
    this.querySelector('#pp-edit-btn')?.addEventListener('click', () => this._render('form', contract));
    this.querySelector('#pp-delete-btn')?.addEventListener('click', () => this._confirmDelete(contract));
  }

  _renderForm(editContract = null) {
    const isEdit = !!editContract;
    let html = this._getStyles();

    html += `<div class="pp-card">
      <div class="pp-back" id="pp-form-cancel">${this._t('cancel')}</div>
      <h3 style="margin:0 0 16px 0;font-size:16px">${isEdit ? '✏️ ' + editContract.name : this._t('new')}</h3>

      <div class="pp-form">
        <div class="pp-field">
          <label>${this._t('name')} *</label>
          <input type="text" id="pp-f-name" value="${isEdit ? this._escapeHtml(editContract.name) : ''}" required>
        </div>

        <div class="pp-row">
          <div class="pp-field">
            <label>${this._t('provider')}</label>
            <input type="text" id="pp-f-provider" value="${isEdit ? this._escapeHtml(editContract.provider || '') : ''}">
          </div>
          <div class="pp-field">
            <label>${this._t('category_label')} *</label>
            <select id="pp-f-category">
              ${PactPilotCard.CATEGORIES.map(c =>
                `<option value="${c.id}" ${isEdit && editContract.category === c.id ? 'selected' : ''}>${c.icon ? c.id : c.id}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="pp-row">
          <div class="pp-field">
            <label>${this._t('cost')} *</label>
            <input type="number" id="pp-f-cost" step="0.01" min="0" value="${isEdit ? editContract.cost : ''}" required>
          </div>
          <div class="pp-field">
            <label>${this._t('cycle')}</label>
            <select id="pp-f-cycle">
              ${['monatlich','vierteljährlich','halbjährlich','jährlich'].map(c =>
                `<option value="${c}" ${isEdit && editContract.cycle === c ? 'selected' : ''}>${this._cycleLabel(c)}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="pp-row">
          <div class="pp-field">
            <label>${this._t('next_payment')}</label>
            <input type="date" id="pp-f-next-payment" value="${isEdit && editContract.next_payment ? editContract.next_payment : ''}">
          </div>
          <div class="pp-field">
            <label>${this._t('status')}</label>
            <select id="pp-f-status">
              <option value="active" ${isEdit && editContract.status === 'active' ? 'selected' : ''}>&#9679; ${this._t('active')}</option>
              <option value="cancelled" ${isEdit && editContract.status === 'cancelled' ? 'selected' : ''}>&#9679; ${this._t('cancelled')}</option>
              <option value="pending" ${isEdit && editContract.status === 'pending' ? 'selected' : ''}>&#9679; ${this._t('pending')}</option>
            </select>
          </div>
        </div>

        <div class="pp-field">
          <label>${this._t('logo')}</label>
          <input type="text" id="pp-f-logo" value="${isEdit ? this._escapeHtml(editContract.logo || '') : ''}" placeholder="mdi:car oder https://...">
        </div>

        <div class="pp-field">
          <label>${this._t('details_label')} (Markdown)</label>
          <textarea id="pp-f-details" rows="8">${isEdit ? this._escapeHtml(editContract.details || '') : ''}</textarea>
        </div>

        <div class="pp-actions" style="margin-top:16px">
          <button class="pp-btn" id="pp-form-cancel-btn">${this._t('cancel')}</button>
          <button class="pp-btn primary" id="pp-form-save">${this._t('save')}</button>
        </div>
      </div>
    </div>`;

    this.innerHTML = html;
    this._bindFormEvents(editContract);
  }

  _bindFormEvents(editContract) {
    this.querySelector('#pp-form-cancel')?.addEventListener('click', () => {
      if (editContract) this._render('detail', editContract);
      else this._render('grid');
    });
    this.querySelector('#pp-form-cancel-btn')?.addEventListener('click', () => {
      if (editContract) this._render('detail', editContract);
      else this._render('grid');
    });
    this.querySelector('#pp-form-save')?.addEventListener('click', () => this._saveContract(editContract));
  }

  _serializeContract() {
    return {
      name: this.querySelector('#pp-f-name')?.value?.trim() || '',
      category: this.querySelector('#pp-f-category')?.value || 'Sonstiges',
      provider: this.querySelector('#pp-f-provider')?.value?.trim() || '',
      cost: parseFloat(this.querySelector('#pp-f-cost')?.value) || 0,
      cycle: this.querySelector('#pp-f-cycle')?.value || 'monatlich',
      next_payment: this.querySelector('#pp-f-next-payment')?.value || '',
      logo: this.querySelector('#pp-f-logo')?.value?.trim() || '',
      details: this.querySelector('#pp-f-details')?.value?.trim() || '',
      status: this.querySelector('#pp-f-status')?.value || 'active'
    };
  }

  _toYaml(contract) {
    let yaml = `name: ${contract.name}
category: ${contract.category}
provider: ${contract.provider}
cost: ${contract.cost}
cycle: ${contract.cycle}
next_payment: "${contract.next_payment}"
logo: ${contract.logo}
status: ${contract.status}`;

    if (contract.details) {
      yaml += `\ndetails: |\n  ${contract.details.replace(/\n/g, '\n  ')}`;
    }
    return yaml;
  }

  async _saveContract(editContract) {
    const data = this._serializeContract();
    if (!data.name) {
      alert(this._t('name') + ' ist erforderlich');
      return;
    }

    const saveBtn = this.querySelector('#pp-form-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
    }

    const yaml = this._toYaml(data);

    try {
      if (editContract) {
        // Update existing
        await this._hass.callService('input_text', 'set_value', {
          entity_id: editContract.entity_id,
          value: yaml
        });
      } else {
        // Create new — fire event for external handler
        const slug = this._slugify(data.name);
        const event = new CustomEvent('pactpilot-create', {
          detail: { name: data.name, slug, value: yaml }
        });
        window.dispatchEvent(event);
      }
    } catch (e) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = this._t('save');
      }
      alert('Fehler beim Speichern: ' + e.message);
      return;
    }

    // Return to grid after save
    setTimeout(() => this._render('grid'), 500);
  }

  _confirmDelete(contract) {
    // Stub for Task 6
    console.warn('_confirmDelete not implemented yet');
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
    this._currentView = view;

    if (view === 'detail' && selectedContract) {
      this._renderDetail(selectedContract);
      return;
    }
    if (view === 'form') {
      this._renderForm(selectedContract);
      return;
    }

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
        <p>${this._t('empty_title')}</p>
        <p>${this._t('empty_subtitle')}</p>
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
                  ? `<img src="${c.logo}" alt="${c.name}" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><ha-icon icon="${this._getCategoryIcon(c.category)}" style="color:${this._getCategoryColor(c.category)};display:none"></ha-icon>`
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
