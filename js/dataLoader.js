/**
 * dataLoader.js
 * 앱 시작 시 모든 데이터를 API에서 불러와 Store에 저장합니다.
 * 데이터 정규화(타입 변환, 날짜 포맷 등)도 여기서 처리합니다.
 */

const DataLoader = (() => {

  // ── 정규화 함수들 ───────────────────────────────────────────

  function normalizeLot(row) {
    return {
      ...row,
      qty:          parseNumber(row.qty),
      price:        parseNumber(row.price),
      country:      String(row.country || '').trim().toUpperCase(),
      biz:          String(row.biz     || '').trim().toUpperCase(),
      lotNo:        String(row.lotNo   || row.id || '').trim(),
      customerName: String(row.customerName || '').trim(),
      done:         String(row.done    || '0').trim(),
      inDate:       normalizeDate(row.inDate),
      targetDate:   normalizeDate(row.targetDate),
      actualDone:   normalizeDate(row.actualDone),
    };
  }

  function normalizeDaily(row) {
    return {
      ...row,
      proc:     parseNumber(row.proc),
      normal:   parseNumber(row.normal),
      noBoot:   parseNumber(row.noBoot),
      abnormal: parseNumber(row.abnormal),
      cumul:    parseNumber(row.cumul),
      remain:   parseNumber(row.remain),
      country:  String(row.country || '').trim().toUpperCase(),
      biz:      String(row.biz     || '').trim().toUpperCase(),
      lotId:    String(row.lotId   || '').trim(),
      done:     String(row.done    || '0').trim(),
      date:     normalizeDate(row.date),
    };
  }

  function normalizeInvoice(row) {
    return {
      ...row,
      amount:   parseNumber(row.amount),
      total:    parseNumber(row.total),
      country:  String(row.country || '').trim().toUpperCase(),
      biz:      String(row.biz     || '').trim().toUpperCase(),
      date:     normalizeDate(row.date),
      due:      normalizeDate(row.due),
      paidDate: normalizeDate(row.paidDate),
    };
  }

  function normalizeCustomer(row) {
    return {
      ...row,
      country: String(row.country || '').trim().toUpperCase(),
      biz:     String(row.biz     || '').trim().toUpperCase(),
      name:    String(row.name    || '').trim(),
    };
  }

  function normalizeShipment(row) {
    return {
      ...row,
      qty:          parseNumber(row.qty),
      country:      String(row.country      || '').trim().toUpperCase(),
      biz:          String(row.biz          || '').trim().toUpperCase(),
      customerName: String(row.customerName || '').trim(),
      lotNo:        String(row.lotNo        || '').trim(),
      expectedDate: normalizeDate(row.expectedDate),
    };
  }

  function normalizeTarget(row) {
    return {
      ...row,
      target: parseNumber(row.target),
      year:   String(row.year || '').trim(),
      biz:    String(row.biz  || '').trim().toUpperCase(),
    };
  }

  // ── Public ──────────────────────────────────────────────────
  return {

    /**
     * 앱 시작 시 모든 데이터 로드
     * 병렬 요청으로 빠르게 처리
     */
    async loadAll() {
      await Api.setupSheets();

      const S = CONFIG.SHEETS;
      const [customers, lots, dailies, invoices, shipments, targets] = await Promise.all([
        Api.getAll(S.CUSTOMERS),
        Api.getAll(S.LOTS),
        Api.getAll(S.DAILY),
        Api.getAll(S.INVOICES),
        Api.getAll(S.SHIPMENTS),
        Api.getAll(S.TARGETS).catch(() => []),
      ]);

      Store.setCustomers(customers.map(normalizeCustomer));
      Store.setLots(lots.map(normalizeLot));
      Store.setDailies(dailies.map(normalizeDaily));
      Store.setInvoices(invoices.map(normalizeInvoice));
      Store.setShipments(shipments.map(normalizeShipment));
      Store.setTargets(targets.map(normalizeTarget));
    },

    /**
     * 특정 시트만 새로고침 (저장 후 갱신할 때)
     */
    async reloadLots() {
      const raw = await Api.getAll(CONFIG.SHEETS.LOTS);
      Store.setLots(raw.map(normalizeLot));
    },

    async reloadDailies() {
      const raw = await Api.getAll(CONFIG.SHEETS.DAILY);
      Store.setDailies(raw.map(normalizeDaily));
    },

    async reloadInvoices() {
      const raw = await Api.getAll(CONFIG.SHEETS.INVOICES);
      Store.setInvoices(raw.map(normalizeInvoice));
    },

    async reloadShipments() {
      const raw = await Api.getAll(CONFIG.SHEETS.SHIPMENTS);
      Store.setShipments(raw.map(normalizeShipment));
    },

    async reloadTargets() {
      const raw = await Api.getAll(CONFIG.SHEETS.TARGETS).catch(() => []);
      Store.setTargets(raw.map(normalizeTarget));
    },

    async reloadCustomers() {
      const raw = await Api.getAll(CONFIG.SHEETS.CUSTOMERS);
      Store.setCustomers(raw.map(normalizeCustomer));
    },
  };

})();
