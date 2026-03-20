/**
 * store.js
 * 앱 전역 상태(State) — 데이터는 여기서만 읽고 씁니다.
 *
 * 규칙:
 *   - 컴포넌트/페이지는 Store.get*() 로만 데이터를 읽는다.
 *   - 데이터 변경은 반드시 Store.set*() 를 통해서만 한다.
 *   - 직접 배열을 수정(push/splice)하지 않는다.
 */

const Store = (() => {

  // ── Private state ──────────────────────────────────────────
  let _customers = [];
  let _lots      = [];
  let _dailies   = [];
  let _invoices  = [];
  let _shipments = [];
  let _targets   = [];

  // UI filter state
  let _lotFilter    = { biz: '', country: '', status: '' };
  let _chartFilter  = { biz: '', country: '', year: new Date().getFullYear() };
  let _countryPeriod = 'month';

  // ── Getters ────────────────────────────────────────────────
  return {
    // Data
    getCustomers:  () => [..._customers],
    getLots:       () => [..._lots],
    getDailies:    () => [..._dailies],
    getInvoices:   () => [..._invoices],
    getShipments:  () => [..._shipments],
    getTargets:    () => [..._targets],

    // Single record lookups
    getLotById:      (id) => _lots.find(l => String(l.id) === String(id)) || null,
    getInvoiceById:  (id) => _invoices.find(i => String(i.id) === String(id)) || null,
    getShipmentById: (id) => _shipments.find(s => String(s.id) === String(id)) || null,
    getTargetFor:    (year, biz) => _targets.find(t => String(t.year) === String(year) && t.biz === biz) || null,

    // ── Setters ──────────────────────────────────────────────
    setCustomers:  (data) => { _customers = data; },
    setLots:       (data) => { _lots      = data; },
    setDailies:    (data) => { _dailies   = data; },
    setInvoices:   (data) => { _invoices  = data; },
    setShipments:  (data) => { _shipments = data; },
    setTargets:    (data) => { _targets   = data; },

    // Upsert (add or replace by id)
    upsertLot: (lot) => {
      const idx = _lots.findIndex(l => String(l.id) === String(lot.id));
      if (idx >= 0) _lots[idx] = lot;
      else _lots.push(lot);
    },
    upsertDaily: (daily) => {
      const idx = _dailies.findIndex(d => String(d.id) === String(daily.id));
      if (idx >= 0) _dailies[idx] = daily;
      else _dailies.push(daily);
    },
    upsertInvoice: (inv) => {
      const idx = _invoices.findIndex(i => String(i.id) === String(inv.id));
      if (idx >= 0) _invoices[idx] = inv;
      else _invoices.push(inv);
    },
    upsertShipment: (ship) => {
      const idx = _shipments.findIndex(s => String(s.id) === String(ship.id));
      if (idx >= 0) _shipments[idx] = ship;
      else _shipments.push(ship);
    },
    upsertTarget: (target) => {
      const idx = _targets.findIndex(t => String(t.year) === String(target.year) && t.biz === target.biz);
      if (idx >= 0) _targets[idx] = target;
      else _targets.push(target);
    },

    // Delete by id
    deleteLot:      (id) => { _lots      = _lots.filter(l => String(l.id) !== String(id)); },
    deleteDaily:    (id) => { _dailies   = _dailies.filter(d => String(d.id) !== String(id)); },
    deleteInvoice:  (id) => { _invoices  = _invoices.filter(i => String(i.id) !== String(id)); },
    deleteShipment: (id) => { _shipments = _shipments.filter(s => String(s.id) !== String(id)); },

    // ── Filter state ─────────────────────────────────────────
    getLotFilter:     () => ({ ..._lotFilter }),
    setLotFilter:     (patch) => { _lotFilter = { ..._lotFilter, ...patch }; },
    resetLotFilter:   () => { _lotFilter = { biz: '', country: '', status: '' }; },

    getChartFilter:   () => ({ ..._chartFilter }),
    setChartFilter:   (patch) => { _chartFilter = { ..._chartFilter, ...patch }; },

    getCountryPeriod: () => _countryPeriod,
    setCountryPeriod: (p) => { _countryPeriod = p; },
  };

})();
