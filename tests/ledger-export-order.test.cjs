const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../components/screens/Ledgers.js'), 'utf8');
// Execute the actual screen's row preparation, without React or a live database.
const preparation = source.slice(source.indexOf(' let balance=0;'), source.indexOf(' const fullPdf='));
const recentPreparation = source.slice(source.indexOf(' const recentJournal='), source.indexOf(' const fullImage='));
function prepare(state, nature = 'Customer') {
  const newestFirst = rows => [...rows].sort((a, b) => b.date.localeCompare(a.date));
  return vm.runInNewContext(`${preparation}\n${recentPreparation}\n({partyRows,exportPartyRows,recentPartyRows,balanceBeforeShown});`, {
    state, nature, partyId: 'party', newestFirst,
  });
}
function fixture(nature) {
  const supplier = nature === 'Supplier';
  const charge = amount => ({ debit: supplier ? 0 : amount, credit: supplier ? amount : 0 });
  const payment = amount => ({ debit: supplier ? amount : 0, credit: supplier ? 0 : amount });
  const invoice = { document: 'INV-00067', lines: [
    { itemName: 'Hosing Grari Pin 6304', quantity: 150, rate: 325 },
    { itemName: 'Goda Pin', quantity: 725, rate: 215 },
  ] };
  return {
    partyLedger: [
      { id: 'invoice', partyId: 'party', date: '2026-10-03', document: invoice.document, ...charge(204625) },
      { id: 'receipt', partyId: 'party', date: '2026-09-27', document: 'REC-1', ...payment(260000) },
      { id: 'opening', partyId: 'party', date: '2026-09-01', document: 'OPENING', ...charge(655032) },
    ],
    sales: supplier ? [] : [invoice], purchases: supplier ? [invoice] : [],
    items: [], journal: [], parties: [],
  };
}
for (const nature of ['Customer', 'Supplier']) {
  test(`${nature}: latest invoice items retain their matching running balances in PDF/image rows`, () => {
    const state = fixture(nature);
    const before = JSON.stringify(state);
    const result = prepare(state, nature);
    assert.equal(result.exportPartyRows, result.partyRows);
    assert.equal(result.exportPartyRows[0].itemName, 'Goda Pin');
    assert.equal(result.exportPartyRows[0].balance, 599657);
    assert.equal(result.exportPartyRows[0].lineTotal, 155875);
    assert.equal(result.exportPartyRows[0].document, 'INV-00067');
    assert.equal(result.exportPartyRows[1].itemName, 'Hosing Grari Pin 6304');
    assert.equal(result.exportPartyRows[1].balance, 443782);
    assert.equal(result.exportPartyRows[1].lineTotal, 48750);
    assert.equal(result.exportPartyRows[1].document, '');
    assert.equal(result.exportPartyRows[2].balance, 395032);
    assert.equal(result.exportPartyRows[2].received, 260000);
    assert.equal(result.recentPartyRows[0].balance, 599657);
    assert.equal(JSON.stringify(state), before);
  });
}
test('recent 20 image keeps the latest rows even when the cutoff splits an invoice', () => {
  const state = fixture('Customer');
  state.sales[0].lines = Array.from({ length: 25 }, (_, i) => ({ itemName: `Item ${i + 1}`, quantity: 1, rate: 10 }));
  state.partyLedger[0].debit = 250;
  const result = prepare(state);
  assert.equal(result.exportPartyRows.length, 27);
  assert.equal(result.recentPartyRows.length, 20);
  assert.equal(result.recentPartyRows[0].itemName, 'Item 25');
  assert.equal(result.recentPartyRows[19].itemName, 'Item 6');
  assert.equal(result.balanceBeforeShown, 395082);
});
test('empty party ledger exports safely', () => {
  const result = prepare({ partyLedger: [], sales: [], purchases: [], items: [], journal: [], parties: [] });
  assert.equal(result.exportPartyRows.length, 0);
  assert.equal(result.balanceBeforeShown, 0);
});
