/**
 * ============================================================================
 * 4대보험 및 소득세 요율 설정 (2026년 기준 개정 요율)
 * ============================================================================
 */
const RATES_CONFIG = {
  // 국민연금 (2026년 기준 근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,
    MAX_BASE: 6170000
  },
  // 건강보험 (2026년 기준 근로자 부담분 3.595%)
  HI: {
    RATE: 0.03595
  },
  // 장기요양보험 (건강보험료의 13.14%)
  LT: {
    RATE_OF_HI: 0.1314
  },
  // 고용보험 (0.9%)
  EI: {
    RATE: 0.009
  },
  // 지방소득세 (소득세의 10%)
  LOCAL_TAX: {
    RATE: 0.10
  }
};

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

  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      if (taxRateGroup) taxRateGroup.style.display = show ? 'block' : 'none';
    });
  }

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

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (보수월액) (원)';
      }
    });
  });

  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      calculate();
    });
  }
});

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
 * 💡 국세청 근로소득 간이세액표 정밀 산출 함수 (WEHAGO 세액 기준 동기화)
 * @param {number} taxable - 과세 대상 급여 (총 세전 - 비과세)
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 선택 원천징수 비율 (100, 80, 50 등)
 */
function getIncomeTax(taxable, dependents = 1, taxRatePercent = 100) {
  // 월 과세급여 106만 원 이하 소액부징수 (0원)
  if (taxable <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = 0;

  // 국세청 간이세액표 과세표준 구간별 기본 산식
  if (taxable <= 1500000) {
    baseTax = (taxable - 1060000) * 0.06 * 0.55;
  } else if (taxable <= 2000000) {
    baseTax = 14520 + (taxable - 1500000) * 0.15 * 0.55;
  } else if (taxable <= 3000000) {
    baseTax = 55770 + (taxable - 2000000) * 0.15 * 0.70;
  } else if (taxable <= 4000000) {
    baseTax = 160770 + (taxable - 3000000) * 0.15 * 0.80;
  } else if (taxable <= 5000000) {
    baseTax = 280770 + (taxable - 4000000) * 0.24 * 0.80;
  } else {
    baseTax = 472770 + (taxable - 5000000) * 0.35 * 0.80;
  }

  // 부양가족 수(공제대상가족 1인 초과)에 따른 차감 공제
  if (dependents > 1) {
    const familyDeduction = (dependents - 1) * 12500;
    baseTax = Math.max(0, baseTax - familyDeduction);
  }

  // 원천징수 비율 적용 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 4대보험 및 소득세 통합 계산 함수
 */
function computeDeductions(taxable) {
  const dependentsInput = document.getElementById('dependents');
  const dependents = parseInt(dependentsInput ? dependentsInput.value : 1, 10) || 1;

  const isNpChecked = document.getElementById('chkNp')?.checked ?? false;
  const isHiChecked = document.getElementById('chkHi')?.checked ?? false;
  const isEiChecked = document.getElementById('chkEi')?.checked ?? false;
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;

  // 1. 국민연금 (4.75%)
  const npBase = Math.min(Math.max(taxable, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험 (3.595%)
  const hi = isHiChecked ? floor10(taxable * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험 (건강보험료의 13.14%)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험 (0.9%)
  const ei = isEiChecked ? floor10(taxable * RATES_CONFIG.EI.RATE) : 0;

  // 5. 정밀 간이세액표 기준 소득세 및 지방소득세
  let it = 0;
  let localTax = 0;

  if (isTaxChecked) {
    it = getIncomeTax(taxable, dependents, getSelectedTaxPercent());
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let gross = 0;
  let taxable = 0;
  let ded = {};
  let net = 0;

  if (currentMode === 'GROSS_TO_NET') {
    // 💡 [Gross→Net]: 입력 기본급(과세)과 비과세 분리 계산
    taxable = amount;
    gross = taxable + taxFree;

    ded = computeDeductions(taxable);
    net = gross - ded.totalDed;
  } else {
    // [Net→Gross]: 목표 실수령액 기준 이분탐색 역산
    let low = Math.max(0, amount - taxFree);
    let high = amount * 2.0;

    for (let i = 0; i < 50; i++) {
      taxable = (low + high) / 2;
      ded = computeDeductions(taxable);
      
      const calcNet = (taxable + taxFree) - ded.totalDed;

      if (Math.abs(calcNet - amount) < 0.1) break;
      if (calcNet < amount) low = taxable; else high = taxable;
    }

    taxable = Math.round(taxable);
    gross = taxable + taxFree;
    ded = computeDeductions(taxable);
    net = gross - ded.totalDed;
  }

  applyValuesToUI(gross, ded, net);
}

function applyValuesToUI(gross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
  }

  document.getElementById('resMainAmount').innerText = fmt(gross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  document.getElementById('resDeduction').innerText = fmt(ded.totalDed);
  document.getElementById('resNetAmount').innerText = fmt(net);

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
