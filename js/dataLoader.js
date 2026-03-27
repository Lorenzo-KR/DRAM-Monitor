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
      // 로딩 상태 표시
      const loadEl = document.getElementById('loading-overlay');
      if (loadEl) loadEl.style.display = 'flex';

      try {
        // 통합 API — 1번 호출로 전체 데이터 수신 (왕복 최소화)
        const token = Auth.getToken();
        const res   = await fetch(`${CONFIG.API_URL}?action=getAllData&token=${token}`);

        let data;
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.error('[DataLoader] JSON 파싱 실패:', jsonErr);
          UI.toast('데이터 파싱 오류 — 새로고침 해주세요', true);
          return;
        }

        if (data?.error === 'UNAUTHORIZED') {
          sessionStorage.removeItem(Auth._TOKEN_KEY);
          location.reload();
          return;
        }

        if (data?.error) {
          console.error('[DataLoader] API 오류:', data.error);
          UI.toast('데이터 로드 오류: ' + data.error, true);
          return;
        }

        Store.setCustomers((data.customers || []).map(normalizeCustomer));
        Store.setLots((data.lots || []).map(normalizeLot));
        Store.setDailies((data.daily || []).map(normalizeDaily));
        Store.setInvoices((data.invoices || []).map(normalizeInvoice));
        Store.setShipments((data.shipments || []).map(normalizeShipment));
        Store.setTargets((data.targets || []).map(normalizeTarget));
        Store.loadSettings(data.settings || []);

        // 로드 결과 콘솔 확인 (개발용)
        console.log('[DataLoader] 로드 완료 —',
          'lots:', Store.getLots().length,
          '| dailies:', Store.getDailies().length,
          '| invoices:', Store.getInvoices().length,
          '| customers:', Store.getCustomers().length
        );

        // settings 시트의 kpi_rolling을 KpiTarget 내부 상태에 동기화
        // ※ Pages.KpiTarget은 dataLoader보다 나중에 로드되므로 존재 여부 확인 필수
        if (typeof Pages !== 'undefined' && Pages.KpiTarget?.loadFromSettings) {
          Pages.KpiTarget.loadFromSettings();
        }
      } catch (err) {
        console.error('[DataLoader] loadAll 오류:', err);
        UI.toast('서버 연결 오류 — 새로고침 해주세요', true);
      } finally {
        if (loadEl) loadEl.style.display = 'none';
      }
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
