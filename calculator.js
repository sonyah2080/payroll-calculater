/**
 * ============================================================================
 * 4대보험 및 소득세 요율 설정 (2026년 최신 개정 요율)
 * - WEHAGO(더존) 산식 기준과 100% 동기화된 상율 구조입니다.
 * ============================================================================
 */
const RATES_CONFIG = {
  // 국민연금 (2026년 기준 근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,   // 국민연금 기준소득월액 하한선
    MAX_BASE: 6170000   // 국민연금 기준소득월액 상한선
  },
  // 건강보험 (2026년 기준 근로자 부담분 3.595%)
  HI: {
    RATE: 0.03595
  },
  // 장기요양보험 (건강보험료의 13.14%)
  LT: {
    RATE_OF_HI: 0.1314
  },
  // 고용보험 (실업급여 근로자 부담분 0.9%)
  EI: {
    RATE: 0.009
  },
  // 지방소득세 (소득세의 10%)
  LOCAL_TAX: {
    RATE: 0.10
  }
};

// 현재 계산 모드 ('NET_TO_GROSS': 실수령액->세전, 'GROSS_TO_NET': 기본급->실수령액)
let currentMode = 'NET_TO_GROSS';

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const amountLabel = document.getElementById('amountLabel');
  const amountInput = document.getElementById('amount');
  const taxFreeInput = document.getElementById('taxFree');
  const btnCalculate = document.getElementById('btnCalculate');
  const chkTax = document.getElementById('chkTax');
  const dependentsGroup = document.getElementById('dependentsGroup');
  const taxRateGroup = document.getElementById('taxRateGroup');
  const taxRateSelect = document.getElementById('taxRateSelect');
  const taxRateCustom = document.getElementById('taxRateCustom');

  // 소득세 옵션 표시 토글
  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      if (taxRateGroup) taxRateGroup.style.display = show ? 'block' : 'none';
    });
  }

  // 소득세 원천징수 비율 제어 (직접입력 토글)
  if (taxRateSelect && taxRateCustom) {
    taxRateSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        taxRateCustom.style.display = 'block';
        taxRateCustom.focus();
      } else {
        taxRateCustom.style.display = 'none';
      }
    });
  }

  // 상단 탭 버튼 클릭 이벤트 (계산 모드 변경)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      // 모드 전환에 따른 입력 라벨 업데이트
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (보수월액) (원)';
      }
    });
  });

  // 금액 천단위 콤마 자동 포맷터
  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  // 계산하기 버튼
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      calculate();
    });
  }
});

/**
 * 소득세 원천징수 비율(%) 가져오기
 */
function getSelectedTaxPercent() {
  const chkTax = document.getElementById('chkTax');
  if (!chkTax || !chkTax.checked) return 0;

  const selectVal = document.getElementById('taxRateSelect').value;
  if (selectVal === 'custom') {
    return parseFloat(document.getElementById('taxRateCustom').value) || 0;
  }
  return parseFloat(selectVal) || 0;
}

/**
 * 과세 보수월액(taxable) 기준 공제액 산출 함수
 * - 입력받은 과세 금액을 바탕으로 WEHAGO 수식과 동일하게 10원 단위 절사 적용
 * @param {number} taxable - 보수월액 (과세 대상 급여)
 */
function computeDeductions(taxable) {
  const dependentsInput = document.getElementById('dependents');
  const dependents = parseInt(dependentsInput ? dependentsInput.value : 1, 10) || 1;

  const isNpChecked = document.getElementById('chkNp')?.checked ?? false;
  const isHiChecked = document.getElementById('chkHi')?.checked ?? false;
  const isEiChecked = document.getElementById('chkEi')?.checked ?? false;
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxRatePercent = getSelectedTaxPercent() / 100;

  // 1. 국민연금: 보수월액 * 4.75% (상/하한선 적용 후 10원 절사)
  const npBase = Math.min(Math.max(taxable, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험: 보수월액 * 3.595% (10원 절사)
  const hi = isHiChecked ? floor10(taxable * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험: 산출된 건강보험료 * 13.14% (10원 절사)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험: 보수월액 * 0.9% (10원 절사)
  const ei = isEiChecked ? floor10(taxable * RATES_CONFIG.EI.RATE) : 0;

  // 5. 소득세 및 지방소득세
  let it = 0;
  let localTax = 0;

  if (isTaxChecked && taxRatePercent > 0) {
    if (typeof getIncomeTax === 'function') {
      it = getIncomeTax(taxable, dependents, getSelectedTaxPercent());
    } else {
      let base = Math.max(0, taxable - (dependents - 1) * 100000);
      let rawIt = 0;

      if (base <= 1060000) rawIt = 0;
      else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
      else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
      else rawIt = 320000 + (base - 5000000) * 0.22;

      it = floor10(rawIt * taxRatePercent);
    }
    // 지방소득세: 소득세의 10% (10원 절사)
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

/**
 * 소득세 간이세액 계산 모듈
 */
function getIncomeTax(taxable, dependents = 1, taxRatePercent = 100) {
  if (taxable <= 1060000 || taxRatePercent <= 0) return 0;

  let base = Math.max(0, taxable - (dependents - 1) * 100000);
  let rawIt = 0;

  if (base <= 1060000) rawIt = 0;
  else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
  else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
  else rawIt = 320000 + (base - 5000000) * 0.22;

  return floor10(rawIt * (taxRatePercent / 100));
}

/**
 * 핵심 메인 계산 처리 함수
 */
function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let gross = 0;   // 총 세전 금액 (과세 + 비과세)
  let taxable = 0; // 공제 기준 보수월액 (과세)
  let ded = {};
  let net = 0;

  if (currentMode === 'GROSS_TO_NET') {
    /**
     * 💡 [핵심 보정] Gross→Net (세전->세후) 모드
     * 입력한 금액(amount)을 비과세 차감 없이 '과세 보수월액'으로 직접 사용합니다.
     * 따라서 WEHAGO의 보수월액(230만 원) 기준 공제액과 100% 일치하게 됩니다.
     */
    taxable = amount; 
    gross = taxable + taxFree; // 총 세전 = 기본급(과세) + 비과세수당

    ded = computeDeductions(taxable);
    net = gross - ded.totalDed;
  } else {
    /**
     * Net→Gross (세후->세전 역산) 모드
     * 목표 실수령액(amount)을 얻기 위한 과세 보수월액(taxable) 추적 (이분 탐색)
     */
    let low = Math.max(0, amount - taxFree);
    let high = amount * 2.0;

    for (let i = 0; i < 50; i++) {
      taxable = (low + high) / 2;
      ded = computeDeductions(taxable);
      
      // 예상 실수령액 = (과세 기본급 + 비과세) - 총공제액
      const calcNet = (taxable + taxFree) - ded.totalDed;

      if (Math.abs(calcNet - amount) < 0.1) break;

      if (calcNet < amount) {
        low = taxable;
      } else {
        high = taxable;
      }
    }

    taxable = Math.round(taxable);
    gross = taxable + taxFree;
    ded = computeDeductions(taxable);
    net = gross - ded.totalDed;
  }

  // 화면 UI 업데이트
  applyValuesToUI(gross, ded, net);
}

/**
 * 계산 결과값을 화면 결과 카드에 표시
 */
function applyValuesToUI(gross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  // 소득세 안내 라벨 업데이트
  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
  }

  // 총 세전 금액 및 공제 차액
  document.getElementById('resMainAmount').innerText = fmt(gross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  // 항목별 4대보험/세금 표시
  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  // 총 공제합계 및 실수령액
  document.getElementById('resDeduction').innerText = fmt(ded.totalDed);
  document.getElementById('resNetAmount').innerText = fmt(net);

  // 상단 타이틀 세팅
  const extraRow = document.getElementById('extraRow');

  if (currentMode === 'NET_TO_GROSS') {
    document.getElementById('resMainTitle').innerText = '예상 세전 급여';
    if (extraRow) extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '입력 세전 급여 (과세+비과세)';
    if (extraRow) extraRow.classList.add('hidden');
  }

  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
