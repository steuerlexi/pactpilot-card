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

  _render() {
    if (!this._hass) return;
    this._rendered = true;
    this.innerHTML = '<ha-card><div class="card-content">PactPilot</div></ha-card>';
  }
}

customElements.define('pactpilot-card', PactPilotCard);
