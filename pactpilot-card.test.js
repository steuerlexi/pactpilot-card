// Minimal DOM mocks so the class can load in Node.js.
global.HTMLElement = class HTMLElement {
  constructor() {}
};
global.customElements = undefined;
global.document = {
  createElement(tag) {
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
global.window = { dispatchEvent() {} };

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

// YAML parse tests
const yaml1 = `name: HUK Autoversicherung
category: Versicherung
provider: HUK24
cost: 540.00
cycle: jährlich
next_payment: "2026-12-01"
logo: mdi:car
details: |
  ## Leistungen
  - Vollkasko
  - 100M € Haftpflicht
  Kontakt: https://huk24.de
status: active`;

const parsed1 = PactPilotCard.parseYaml(yaml1);
assertEqual(parsed1.name, 'HUK Autoversicherung', 'parse simple name');
assertEqual(parsed1.category, 'Versicherung', 'parse category');
assertEqual(parsed1.cost, '540.00', 'parse cost string');
assertTrue(parsed1.details.includes('## Leistungen'), 'parse markdown heading in details');
assertTrue(parsed1.details.includes('- Vollkasko'), 'parse list item in details');
assertTrue(parsed1.details.includes('Kontakt: https://huk24.de'), 'parse line with colon in details');
assertEqual(parsed1.status, 'active', 'parse status');

// Markdown render tests
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

// YAML roundtrip test
const contract = {
  name: 'Netflix',
  category: 'Streaming',
  provider: 'Netflix Inc.',
  cost: 12.99,
  cycle: 'monatlich',
  next_payment: '2026-08-15',
  logo: 'mdi:television',
  details: '## Paket\n- Ultra HD\n- 4 Screens',
  status: 'active'
};
const yamlOut = PactPilotCard.toYamlStatic(contract);
const reparsed = PactPilotCard.parseYaml(yamlOut);
assertEqual(reparsed.name, 'Netflix', 'roundtrip name');
assertEqual(reparsed.category, 'Streaming', 'roundtrip category');
assertEqual(reparsed.provider, 'Netflix Inc.', 'roundtrip provider with dot');
assertEqual(reparsed.cost, '12.99', 'roundtrip cost');
assertEqual(reparsed.details, contract.details, 'roundtrip details');

// YAML length check
assertTrue(yamlOut.length <= 255, `YAML length ${yamlOut.length} <= 255`);

// Edge cases
const yamlQuote = `name: "Sonder: Name"
category: Sonstiges
provider: ''
cost: 0
cycle: monatlich
next_payment: ""
logo: "mdi:test"
status: cancelled`;
const parsedQuote = PactPilotCard.parseYaml(yamlQuote);
assertEqual(parsedQuote.name, 'Sonder: Name', 'parse quoted name with colon');
assertEqual(parsedQuote.provider, '', 'parse empty single-quoted value');
assertEqual(parsedQuote.logo, 'mdi:test', 'parse quoted logo');

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
