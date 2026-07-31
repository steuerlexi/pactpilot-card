// PactPilot Card for Home Assistant — version 1.1.1
class PactPilotCard extends HTMLElement {
  constructor() {
    super();
    // Only initialize state here; DOM manipulation must happen in connectedCallback()
    // because creating children in a custom element constructor is not allowed.
    this._container = null;
    this._hass = null;
    this.config = {};
    this._activeCategory = 'Alle';
    this._customCategories = null;
    // View state so state updates don't force us back to grid
    this._view = 'grid';
    this._viewContract = null;
  }

  connectedCallback() {
    // (Re-)create container if it is missing (e.g. after the element was temporarily detached).
    if (!this._container) {
      this.innerHTML = this._getStyles();
      this._container = document.createElement('div');
      this._container.className = 'pp-container';
      this.appendChild(this._container);
    }
    // Always (re-)bind the delegated click listener. If it is already attached,
    // removeEventListener is a no-op, so this is safe after detach/reattach cycles.
    if (!this._clickHandler) {
      this._clickHandler = this._handleClick.bind(this);
    }
    this.removeEventListener('click', this._clickHandler);
    this.addEventListener('click', this._clickHandler);
    if (this._hass) this._render();
  }

  disconnectedCallback() {
    // Detach the listener, but keep the bound reference so connectedCallback
    // can re-attach it without creating a new function each time.
    if (this._clickHandler) {
      this.removeEventListener('click', this._clickHandler);
    }
  }

  setConfig(config) {
    this.config = {
      categories: null,
      ...config
    };
    if (this.config.categories && Array.isArray(this.config.categories)) {
      this._customCategories = this.config.categories;
    }
    // Force a re-render on next hass update because config (e.g. categories) changed.
    this._stateHash = null;
  }

  get _categories() {
    return this._customCategories || PactPilotCard.CATEGORIES;
  }

  set hass(hass) {
    if (!hass) return;
    // Home Assistant calls set hass on every state update. Re-rendering the entire
    // grid each time replaces the DOM under the user's cursor and can swallow clicks.
    // Only re-render when a PactPilot contract sensor changes.
    const newHash = this._computeStateHash(hass);
    if (this._stateHash === newHash) return;
    this._stateHash = newHash;
    this._hass = hass;
    try {
      this._render();
    } catch (e) {
      const target = this._container || this;
      target.innerHTML = `<ha-card>Error: ${e.message}</ha-card>`;
    }
  }

  _computeStateHash(hass) {
    const parts = [];
    for (const [entityId, stateObj] of Object.entries(hass.states || {})) {
      if (entityId.startsWith('sensor.pactpilot_') && !entityId.endsWith('_details')) {
        parts.push(`${entityId}=${stateObj?.state || ''}:${stateObj?.last_updated || ''}:${stateObj?.last_changed || ''}`);
      }
    }
    return parts.sort().join('|');
  }

  _findEventTarget(e, selector) {
    // Home Assistant icons are rendered in a Shadow DOM. A plain click target may
    // live inside a shadow root, so closest() returns null. composedPath() walks the
    // full event path across shadow boundaries and lets us reliably find elements.
    if (e.composedPath) {
      const path = e.composedPath();
      for (const el of path) {
        if (el === this || el === window || el === document) break;
        if (el instanceof Element && el.matches && el.matches(selector)) return el;
      }
    }
    return e.target.closest(selector);
  }

  _handleClick(e) {
    // Grid view handlers
    const pill = this._findEventTarget(e, '.pp-pill');
    if (pill && this._view === 'grid') {
      this._activeCategory = pill.dataset.category;
      this._render('grid');
      return;
    }

    const tile = this._findEventTarget(e, '.pp-tile');
    if (tile && this._view === 'grid') {
      const entityId = tile.dataset.entity;
      const contract = this._getContracts().find(c => c.entity_id === entityId);
      if (contract) this._render('detail', contract);
      return;
    }

    const addBtn = this._findEventTarget(e, '#pp-add-btn');
    if (addBtn && this._view === 'grid') {
      this._render('form');
      return;
    }

    // Detail view handlers
    const backBtn = this._findEventTarget(e, '#pp-back-btn');
    if (backBtn && this._view === 'detail') {
      this._render('grid');
      return;
    }

    const editBtn = this._findEventTarget(e, '#pp-edit-btn');
    if (editBtn && this._view === 'detail' && this._viewContract) {
      this._render('form', this._viewContract);
      return;
    }

    const deleteBtn = this._findEventTarget(e, '#pp-delete-btn');
    if (deleteBtn && this._view === 'detail' && this._viewContract) {
      this._confirmDelete(this._viewContract);
      return;
    }

    const urlBtn = this._findEventTarget(e, '#pp-url-btn');
    if (urlBtn && this._view === 'detail') {
      // Real <a> with target="_blank" should handle itself, but guard for any
      // delegated fallback that still reaches here.
      return;
    }

    // Form view handlers
    const cancelBtn = this._findEventTarget(e, '#pp-form-cancel, #pp-form-cancel-btn');
    if (cancelBtn && this._view === 'form') {
      if (this._viewContract) this._render('detail', this._viewContract);
      else this._render('grid');
      return;
    }

    const saveBtn = this._findEventTarget(e, '#pp-form-save');
    if (saveBtn && this._view === 'form') {
      e.preventDefault();
      this._saveContract(this._viewContract);
    }
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
        owner: 'Eigentümer',
        logo: 'Logo / Icon',
        url: 'URL',
        open_url: 'URL öffnen',
        name: 'Name',
        status: 'Status',
        contracts_zero: 'Keine Verträge',
        contracts_one: '1 Vertrag',
        contracts: 'Verträge',
        empty_title: 'Keine Verträge gefunden',
        empty_subtitle: 'In dieser Kategorie gibt es keine Einträge.',
        validation_required: 'ist erforderlich',
        save_error: 'Fehler beim Speichern',
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
        owner: 'Owner',
        logo: 'Logo / Icon',
        url: 'URL',
        open_url: 'Open URL',
        name: 'Name',
        status: 'Status',
        contracts_zero: 'No contracts',
        contracts_one: '1 contract',
        contracts: 'contracts',
        empty_title: 'No contracts found',
        empty_subtitle: 'There are no entries in this category.',
        validation_required: 'is required',
        save_error: 'Error saving',
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

  static get OWNERS() {
    return ['Alexander', 'Beata', 'Isabella', 'Noah', 'Klara'];
  }

  get _lang() {
    return (this._hass?.locale?.language === 'de') ? 'de' : 'en';
  }

  _t(key) {
    return PactPilotCard.I18N[this._lang][key] || key;
  }

  _cycleLabel(cycle) {
    return PactPilotCard.I18N[this._lang].cycles[cycle] || cycle;
  }

  _statusLabel(status) {
    return this._t(status);
  }

  _contractSlug(entityId) {
    const match = entityId.match(/^sensor\.pactpilot_(.+)$/);
    return match ? match[1] : null;
  }

  _getContracts() {
    if (!this._hass) return [];
    const contracts = [];
    for (const [entityId, stateObj] of Object.entries(this._hass.states)) {
      // AppDaemon stores each contract as one sensor. Skip legacy detail-only sensors.
      if (!entityId.startsWith('sensor.pactpilot_') || entityId.endsWith('_details')) continue;
      const attrs = stateObj?.attributes || {};
      if (!attrs.name) continue;
      contracts.push({
        entity_id: entityId,
        name: attrs.name,
        category: attrs.category || 'Sonstiges',
        provider: attrs.provider || '',
        owner: attrs.owner || '',
        cost: parseFloat(attrs.cost) || 0,
        cycle: attrs.cycle || 'monatlich',
        next_payment: attrs.next_payment || '',
        logo: attrs.logo || '',
        url: attrs.url || '',
        details: attrs.markdown || '',
        status: stateObj.state || 'active'
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
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
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
        .pp-tile-logo * { pointer-events: none; }
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
        .pp-form-status {
          display: none;
          padding: 8px 10px;
          margin-bottom: 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        .pp-form-status.error {
          background: rgba(244,67,54,0.12);
          color: #f44336;
          border: 1px solid rgba(244,67,54,0.3);
        }
        .pp-form-status.success {
          background: rgba(76,175,80,0.12);
          color: #4caf50;
          border: 1px solid rgba(76,175,80,0.3);
        }
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
        @media (prefers-color-scheme: dark) {
          .pp-markdown code { background: rgba(255,255,255,0.1); }
        }
        @media (max-width: 400px) {
          .pp-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
          .pp-meta { grid-template-columns: 1fr; }
          .pp-row { flex-direction: column; gap: 0; }
        }
      </style>
    `;
  }

  _getCategoryIcon(categoryId) {
    const cat = this._categories.find(c => c.id === categoryId);
    return cat ? cat.icon : 'mdi:dots-horizontal';
  }

  _getCategoryColor(categoryId) {
    const cat = this._categories.find(c => c.id === categoryId);
    return cat ? cat.color : '#9e9e9e';
  }

  _isIconReference(str) {
    // Any pack prefix like mdi:, hue:, phu:, custom:brand-icon etc.
    // URLs and local paths are excluded.
    return typeof str === 'string' && /^[a-z0-9_-]+:/.test(str) && !/^https?:/i.test(str);
  }

  _isImageUrl(str) {
    return typeof str === 'string' && (/^https?:\/\//i.test(str) || str.startsWith('/'));
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(this._lang === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  static _inlineMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        const safe = /^(https?:|mailto:|\/)/i.test(url) ? url : '#';
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      });
  }

  static renderMarkdown(md) {
    if (!md || typeof md !== 'string') return '';

    // Strip HTML tags from source for security (defense-in-depth)
    const html = md.replace(/<[^>]*>/g, '');

    const lines = html.split('\n');
    const blocks = [];
    let currentList = [];
    let inParagraph = false;

    const flushList = () => {
      if (currentList.length) {
        blocks.push('<ul>' + currentList.map(li => `<li>${li}</li>`).join('') + '</ul>');
        currentList = [];
      }
    };

    const flushParagraph = () => {
      if (inParagraph) {
        blocks.push('</p>');
        inParagraph = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        flushList();
        flushParagraph();
        continue;
      }

      // Horizontal rule
      if (trimmed === '---') {
        flushList();
        flushParagraph();
        blocks.push('<hr>');
        continue;
      }

      // Headings
      const headingMatch = trimmed.match(/^(#{1,3}) (.+)$/);
      if (headingMatch) {
        flushList();
        flushParagraph();
        const level = headingMatch[1].length;
        const tag = level === 1 ? 'h3' : (level === 2 ? 'h4' : 'h5');
        blocks.push(`<${tag}>${PactPilotCard._inlineMarkdown(headingMatch[2])}</${tag}>`);
        continue;
      }

      // List item
      if (trimmed.startsWith('- ')) {
        flushParagraph();
        currentList.push(PactPilotCard._inlineMarkdown(trimmed.substring(2)));
        continue;
      }

      // Regular paragraph line
      if (!inParagraph) {
        flushList();
        blocks.push('<p>');
        inParagraph = true;
      } else {
        blocks.push('<br>');
      }
      blocks.push(PactPilotCard._inlineMarkdown(line));
    }

    flushList();
    flushParagraph();

    return blocks.join('');
  }

  _renderDetail(contract) {
    let html = `<div class="pp-card">
      <div class="pp-back" id="pp-back-btn">${this._t('back')}</div>

      <div class="pp-hero">
        <div class="pp-hero-logo">
          ${this._isIconReference(contract.logo)
            ? `<ha-icon icon="${this._escapeHtml(contract.logo)}" style="color:${this._getCategoryColor(contract.category)};--mdc-icon-size:32px"></ha-icon>`
            : this._isImageUrl(contract.logo)
              ? `<img src="${this._escapeHtml(contract.logo)}" alt="${this._escapeHtml(contract.name)}" style="width:48px;height:48px;object-fit:contain" onerror="this.style.display='none'">`
              : `<ha-icon icon="${this._getCategoryIcon(contract.category)}" style="color:${this._getCategoryColor(contract.category)};--mdc-icon-size:32px"></ha-icon>`
          }
        </div>
        <div class="pp-hero-info">
          <h3>${this._escapeHtml(contract.name)}</h3>
          <div class="pp-hero-provider">${this._escapeHtml(contract.provider || '')}</div>
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
            ${this._escapeHtml(contract.category)}
          </div>
        </div>
        <div class="pp-meta-item">
          <div class="pp-meta-label">${this._t('owner')}</div>
          <div class="pp-meta-value">${this._escapeHtml(contract.owner || '—')}</div>
        </div>
      </div>`;

    if (contract.details) {
      html += `<div class="pp-details">
        <h4>${this._t('details_label')}</h4>
        <div class="pp-markdown">${PactPilotCard.renderMarkdown(contract.details)}</div>
      </div>`;
    }

    html += `<div class="pp-actions">`;
    if (contract.url) {
      html += `<a class="pp-btn primary" id="pp-url-btn" href="${this._escapeHtml(contract.url)}" target="_blank" rel="noopener noreferrer">${this._t('open_url')}</a>`;
    }
    html += `<button type="button" class="pp-btn${contract.url ? '' : ' primary'}" id="pp-edit-btn">${this._t('edit')}</button>
      <button type="button" class="pp-btn danger" id="pp-delete-btn">${this._t('delete')}</button>
    </div>`;

    html += `</div>`;
    this._container.innerHTML = html;
    this._bindDetailEvents(contract);
  }

  _bindDetailEvents(contract) {
    // No-op: delegated click handler is attached once on the element in connectedCallback().
  }

  _renderForm(editContract = null) {
    const isEdit = !!editContract;
    let html = `<div class="pp-card">
      <div class="pp-back" id="pp-form-cancel">${this._t('cancel')}</div>
      <h3 style="margin:0 0 16px 0;font-size:16px">${isEdit ? '✏️ ' + this._escapeHtml(editContract.name) : this._t('new')}</h3>

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
              ${this._categories.map(c =>
                `<option value="${c.id}" ${isEdit && editContract.category === c.id ? 'selected' : ''}>${c.id}</option>`
              ).join('')}
            </select>
          </div>
          <div class="pp-field">
            <label>${this._t('owner')}</label>
            <select id="pp-f-owner">
              <option value="" ${isEdit && !editContract.owner ? 'selected' : ''}>—</option>
              ${PactPilotCard.OWNERS.map(o =>
                `<option value="${o}" ${isEdit && editContract.owner === o ? 'selected' : ''}>${o}</option>`
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
          <label>${this._t('url')}</label>
          <input type="url" id="pp-f-url" value="${isEdit ? this._escapeHtml(editContract.url || '') : ''}" placeholder="https://...">
        </div>

        <div class="pp-field">
          <label>${this._t('details_label')} (Markdown)</label>
          <textarea id="pp-f-details" rows="8">${isEdit ? this._escapeHtml(editContract.details || '') : ''}</textarea>
        </div>

        <div class="pp-actions" style="margin-top:16px">
          <button type="button" class="pp-btn" id="pp-form-cancel-btn">${this._t('cancel')}</button>
          <button type="button" class="pp-btn primary" id="pp-form-save">${this._t('save')}</button>
        </div>
      </div>
    </div>`;

    this._container.innerHTML = html;
    this._bindFormEvents(editContract);
  }

  _bindFormEvents(editContract) {
    // No-op: delegated click handler is attached once on the element in connectedCallback().
  }

  _serializeContract() {
    return {
      name: this.querySelector('#pp-f-name')?.value?.trim() || '',
      category: this.querySelector('#pp-f-category')?.value || 'Sonstiges',
      provider: this.querySelector('#pp-f-provider')?.value?.trim() || '',
      owner: this.querySelector('#pp-f-owner')?.value || '',
      cost: parseFloat(this.querySelector('#pp-f-cost')?.value) || 0,
      cycle: this.querySelector('#pp-f-cycle')?.value || 'monatlich',
      next_payment: this.querySelector('#pp-f-next-payment')?.value || '',
      logo: this.querySelector('#pp-f-logo')?.value?.trim() || '',
      url: this.querySelector('#pp-f-url')?.value?.trim() || '',
      details: this.querySelector('#pp-f-details')?.value?.trim() || '',
      status: this.querySelector('#pp-f-status')?.value || 'active'
    };
  }

  _ensureFormStatus() {
    let el = this.querySelector('#pp-form-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pp-form-status';
      el.className = 'pp-form-status';
      const form = this.querySelector('.pp-form');
      if (form) form.insertBefore(el, form.firstChild);
    }
    return el;
  }

  _showFormStatus(message, type) {
    const el = this._ensureFormStatus();
    if (!el) return;
    el.textContent = message;
    el.className = 'pp-form-status ' + (type || '');
    el.style.display = 'block';
  }

  async _saveContract(editContract) {
    const data = this._serializeContract();

    if (!data.name) {
      this._showFormStatus(this._t('name') + ' ' + this._t('validation_required'), 'error');
      return;
    }

    const saveBtn = this.querySelector('#pp-form-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
    }

    const slug = editContract
      ? this._contractSlug(editContract.entity_id)
      : this._slugify(data.name);

    if (!slug) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = this._t('save');
      }
      this._showFormStatus(this._t('save_error'), 'error');
      return;
    }

    try {
      // Fire HA event for the AppDaemon backend via the WebSocket API.
      // Browser CustomEvents never reach HA/AppDaemon; fire_event is the
      // correct bridge. The backend creates/updates sensor.pactpilot_<slug>
      // with the contract status as state and all other data (including the
      // long Markdown) as attributes, bypassing HA's 255-character limit.
      if (!this._hass?.connection) {
        throw new Error('No HA connection');
      }
      await this._hass.connection.sendMessagePromise({
        type: 'fire_event',
        event_type: 'pactpilot_save',
        event_data: {
          slug,
          entity_id: editContract ? editContract.entity_id : `sensor.pactpilot_${slug}`,
          name: data.name,
          category: data.category,
          provider: data.provider,
          owner: data.owner,
          cost: data.cost,
          cycle: data.cycle,
          next_payment: data.next_payment,
          logo: data.logo,
          url: data.url,
          status: data.status,
          details: data.details
        }
      });
    } catch (e) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = this._t('save');
      }
      this._showFormStatus(this._t('save_error') + ': ' + e.message, 'error');
      console.error('[pactpilot-card] save failed', e);
      return;
    }

    this._showFormStatus('Gespeichert.', 'success');
    setTimeout(() => this._render('grid'), 600);
  }

  _confirmDelete(contract) {
    if (confirm(this._t('confirm_delete') + `\n\n"${contract.name}"`)) {
      this._deleteContract(contract);
    }
  }

  async _deleteContract(contract) {
    const slug = this._contractSlug(contract.entity_id);
    if (!slug) {
      this._render('grid');
      return;
    }

    // Notify the AppDaemon backend to remove the contract sensor.
    // Browser events do not cross into HA; fire the HA event via the
    // WebSocket API so the backend can remove sensor.pactpilot_<slug>.
    try {
      if (!this._hass?.connection) {
        throw new Error('No HA connection');
      }
      await this._hass.connection.sendMessagePromise({
        type: 'fire_event',
        event_type: 'pactpilot_delete',
        event_data: { slug, entity_id: contract.entity_id }
      });
    } catch (e) {
      console.error('[pactpilot-card] delete event failed', e);
      return;
    }

    this._render('grid');
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

  _ensureContainer() {
    if (!this._container) {
      this.innerHTML = this._getStyles();
      this._container = document.createElement('div');
      this._container.className = 'pp-container';
      this.appendChild(this._container);
    }
    return this._container;
  }

  _render(view = this._view, selectedContract = this._viewContract) {
    if (!this._hass) return;
    this._ensureContainer();

    // Persist view state so state updates don't rip us out of detail/form
    this._view = view;
    this._viewContract = selectedContract || null;

    if (this._view === 'detail' && this._viewContract) {
      this._renderDetail(this._viewContract);
      return;
    }
    if (this._view === 'form') {
      // Don't re-render an open form on state updates; it would wipe user input and focus.
      if (this._container.querySelector('#pp-form-save')) return;
      this._renderForm(this._viewContract);
      return;
    }

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

    const categories = ['Alle', ...this._categories.map(c => c.id)];

    let html = `<div class="pp-card">
      <div class="pp-header">
        <h3>${this._t('title')}</h3>
        <button type="button" class="pp-add-btn" id="pp-add-btn">${this._t('new')}</button>
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
              ${this._isIconReference(c.logo)
                ? `<ha-icon icon="${this._escapeHtml(c.logo)}" style="color:${this._getCategoryColor(c.category)}"></ha-icon>`
                : this._isImageUrl(c.logo)
                  ? `<img src="${this._escapeHtml(c.logo)}" alt="${this._escapeHtml(c.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><ha-icon icon="${this._getCategoryIcon(c.category)}" style="color:${this._getCategoryColor(c.category)};display:none"></ha-icon>`
                  : `<ha-icon icon="${this._getCategoryIcon(c.category)}" style="color:${this._getCategoryColor(c.category)}"></ha-icon>`
              }
            </div>
            <div class="pp-tile-name">${this._escapeHtml(c.name)}</div>
            <div class="pp-tile-provider">${this._escapeHtml(c.provider || '')}</div>
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
    this._container.innerHTML = html;
  }

  _bindEvents() {
    // No-op: delegated click handler is attached once on the element in connectedCallback().
  }

  getCardSize() {
    return 5;
  }
}

if (typeof customElements !== 'undefined') {
  customElements.define('pactpilot-card', PactPilotCard);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PactPilotCard };
}
