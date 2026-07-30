// Minimal DOM mocks so the class can load in Node.js.
global.HTMLElement = class HTMLElement {
  constructor() {}
};
global.customElements = undefined;
global.document = {
  createElement(tag) {
    if (tag === 'div') {
      return {
        className: '',
        style: {},
        _text: '',
        set textContent(v) { this._text = String(v); },
        get innerHTML() {
          return this._text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        },
        appendChild() {},
        insertBefore() {},
        querySelector() { return null; },
        closest() { return null; },
        addEventListener() {},
        removeEventListener() {}
      };
    }
    return {
      className: '',
      textContent: '',
      innerHTML: '',
      style: {},
      appendChild() {},
      insertBefore() {},
      querySelector() { return null; },
      closest() { return null; },
      addEventListener() {},
      removeEventListener() {}
    };
  }
};
const { PactPilotCard } = require('./pactpilot-card.js');

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}`);
    console.error('  expected:', JSON.stringify(expected));
    console.error('  actual:  ', JSON.stringify(actual));
    process.exitCode = 1;
  } else {
    console.log(`PASS ${label}`);
  }
}

function assertTrue(condition, label) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${label}`);
  }
}

// --- Sensor-based contract reading ---

const card = new PactPilotCard();
card._hass = {
  locale: { language: 'de' },
  states: {
    'sensor.pactpilot_netflix': {
      state: 'active',
      last_updated: '2026-07-30T10:00:00',
      last_changed: '2026-07-30T10:00:00',
      attributes: {
        name: 'Netflix',
        category: 'Streaming',
        provider: 'Netflix Inc.',
        cost: 12.99,
        cycle: 'monatlich',
        next_payment: '2026-08-15',
        logo: 'mdi:television',
        url: 'https://netflix.com/manage',
        markdown: '## Paket\n- Ultra HD\n- 4 Screens'
      }
    },
    'sensor.pactpilot_huk_auto': {
      state: 'active',
      last_updated: '2026-07-30T09:00:00',
      last_changed: '2026-07-30T09:00:00',
      attributes: {
        name: 'HUK Autoversicherung',
        category: 'Versicherung',
        provider: 'HUK24',
        cost: 540.00,
        cycle: 'jährlich',
        next_payment: '2026-12-01',
        logo: 'mdi:car',
        url: '',
        markdown: '## Leistungen\n- Vollkasko\n- 100M € Haftpflicht'
      }
    },
    // Legacy detail-only sensor must be ignored.
    'sensor.pactpilot_netflix_details': {
      state: 'legacy',
      last_updated: '2026-07-30T08:00:00',
      attributes: { markdown: 'should be ignored' }
    },
    // Sensors without a name attribute are ignored.
    'sensor.pactpilot_orphan': {
      state: 'active',
      last_updated: '2026-07-30T07:00:00',
      attributes: { category: 'Sonstiges' }
    }
  }
};

const contracts = card._getContracts();
assertEqual(contracts.length, 2, 'reads only valid contract sensors');
assertEqual(contracts[0].name, 'Netflix', 'first by next_payment date');
assertEqual(contracts[1].name, 'HUK Autoversicherung', 'second by later date');
assertEqual(contracts[0].details, '## Paket\n- Ultra HD\n- 4 Screens', 'details from markdown attribute');
assertEqual(contracts[0].status, 'active', 'status from sensor state');
assertEqual(contracts[1].cost, 540.00, 'cost parsed from attribute');

// --- State hash ---

const hash = card._computeStateHash(card._hass);
assertTrue(hash.includes('sensor.pactpilot_netflix=active'), 'hash includes contract state');
assertTrue(!hash.includes('_details'), 'hash ignores legacy detail sensors');

// --- Monthly cost ---

assertEqual(card._computeMonthlyCost({ cost: 12, cycle: 'monatlich' }), 12, 'monthly cost');
assertEqual(card._computeMonthlyCost({ cost: 120, cycle: 'jährlich' }), 10, 'annual cost monthly');
assertEqual(card._computeMonthlyCost({ cost: 90, cycle: 'vierteljährlich' }), 30, 'quarterly cost monthly');
assertEqual(card._computeMonthlyCost({ cost: 60, cycle: 'halbjährlich' }), 10, 'semi-annual cost monthly');

// --- Slugify ---

assertEqual(card._slugify('HUK Autoversicherung'), 'huk_autoversicherung', 'slugify German name');
assertEqual(card._slugify('  ÄÖÜ ß Test!  '), 'aeoeue_ss_test', 'slugify special chars');

// --- Icon / image detection ---

assertTrue(card._isIconReference('mdi:car'), 'mdi is icon reference');
assertTrue(card._isIconReference('hue:bulb'), 'hue is icon reference');
assertTrue(card._isIconReference('custom:brand-icon'), 'custom pack is icon reference');
assertTrue(!card._isIconReference('https://example.com/icon.png'), 'URL is not icon reference');
assertTrue(card._isImageUrl('https://example.com/icon.png'), 'HTTPS is image URL');
assertTrue(card._isImageUrl('/local/icon.png'), 'local path is image URL');

// --- Format date ---

card._hass.locale.language = 'de';
assertEqual(card._formatDate('2026-12-01'), '01.12.2026', 'German date format');
card._hass.locale.language = 'en';
assertEqual(card._formatDate('2026-12-01'), '12/01/2026', 'US date format');

// --- i18n ---

card._hass.locale.language = 'de';
assertEqual(card._t('title'), 'Verträge & Abos', 'German title');
assertEqual(card._cycleLabel('jährlich'), 'jährlich', 'German cycle');
assertEqual(card._statusLabel('cancelled'), 'gekündigt', 'German status');
card._hass.locale.language = 'en';
assertEqual(card._t('title'), 'Contracts & Subscriptions', 'English title');
assertEqual(card._cycleLabel('jährlich'), 'annually', 'English cycle');

// --- Escape HTML ---

assertEqual(card._escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'escape HTML');

// --- Markdown render tests ---

const md1 = `## Coverage
- Full comprehensive
- Liability 100M €
Visit [HUK24](https://huk24.de)`;
const html1 = PactPilotCard.renderMarkdown(md1);
assertTrue(html1.includes('<h4>Coverage</h4>'), 'render heading level 2');
assertTrue(html1.includes('<ul>'), 'render unordered list wrapper');
assertTrue(html1.includes('<li>Full comprehensive</li>'), 'render list item');
assertTrue(html1.includes('<a href="https://huk24.de"'), 'render link');
assertTrue(html1.includes('target="_blank"'), 'render link target');

// Markdown edge: details with blank lines
const md2 = `## A

Text block.

- item 1
- item 2

More text.`;
const html2 = PactPilotCard.renderMarkdown(md2);
assertTrue(html2.includes('<h4>A</h4>'), 'render heading after blank line');
assertTrue(html2.includes('<p>Text block.</p>'), 'render paragraph');
assertTrue(html2.includes('<ul><li>item 1</li><li>item 2</li></ul>'), 'render list separated by blank lines');
assertTrue(html2.includes('<p>More text.</p>'), 'render trailing paragraph');

console.log('\nDone.');
