/**
 * ============================================================================
 * 4대보험 및 소득세 요율 설정 (연도별 개정 시 이 부분만 수정)
 * ============================================================================
 */
const RATES_CONFIG = {
  // 국민연금 (2026년 기준 근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,   // 기준소득월액 하한선
    MAX_BASE: 6170000   // 기준소득월액 상한선
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

  chkTax.addEventListener('change', (e) => {
    const show = e.target.checked;
    dependentsGroup.style.display = show ? 'block' : 'none';
    taxRateGroup.style.display = show ? 'block' : 'none';
  });

  taxRateSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      taxRateCustom.style.display = 'block';
      taxRateCustom.focus();
    } else {
      taxRateCustom.style.display = 'none';
    }
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '세전 급여 (원)';
    });
  });

  if (typeof attachFormatter === 'function') {
    attachFormatter(amountInput);
    attachFormatter(taxFreeInput);
  }

  btnCalculate.addEventListener('click', (e) => {
    e.preventDefault();
    calculate();
  });
});

function getSelectedTaxPercent() {
  const isTaxChecked = document.getElementById('chkTax').checked;
  if (!isTaxChecked) return 0;

  const selectVal = document.getElementById('taxRateSelect').value;
  if (selectVal === 'custom') {
    return parseFloat(document.getElementById('taxRateCustom').value) || 0;
  }
  return parseFloat(selectVal) || 0;
}

/**
 * 공제 항목별 세액 산출 함수 (상단 RATES_CONFIG 요율 참조)
 */
function computeDeductions(g) {
  const taxFree = parseCurrency(document.getElementById('taxFree').value);
  const dependents = parseInt(document.getElementById('dependents').value, 10) || 1;

  const isNpChecked = document.getElementById('chkNp').checked;
  const isHiChecked = document.getElementById('chkHi').checked;
  const isEiChecked = document.getElementById('chkEi').checked;
  const isTaxChecked = document.getElementById('chkTax').checked;
  const taxRatePercent = getSelectedTaxPercent() / 100;

  // 과세 대상 금액 (세전총급여 - 비과세)
  const taxable = Math.max(0, g - taxFree);
  
  // 1. 국민연금 산출 (상/하한선 및 요율 적용)
  const npBase = Math.min(Math.max(taxable, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험 산출
  const hi = isHiChecked ? floor10(taxable * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험 산출 (건강보험료 기준 요율)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험 산출
  const ei = isEiChecked ? floor10(taxable * RATES_CONFIG.EI.RATE) : 0;

  // 5. 소득세 및 지방소득세 산출
  let it = 0, localTax = 0;
  if (isTaxChecked && taxRatePercent > 0) {
    let base = Math.max(0, taxable - (dependents - 1) * 100000);
    let rawIt = 0;

    // 간이세액 구간 산식
    if (base <= 1060000) rawIt = 0;
    else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
    else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
    else rawIt = 320000 + (base - 5000000) * 0.22;
    
    it = floor10(rawIt * taxRatePercent);
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

/**
 * 외부 모듈(prorated.js 등) 연동용 소득세 추출 보조 함수
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

function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  let gross = 0;

  if (currentMode === 'GROSS_TO_NET') {
    gross = amount;
  } else {
    let low = amount, high = amount * 1.6;
    for (let i = 0; i < 40; i++) {
      gross = (low + high) / 2;
      const ded = computeDeductions(gross);
      const net = gross - ded.totalDed;
      if (Math.abs(net - amount) < 1) break;
      if (net < amount) low = gross; else high = gross;
    }
    gross = Math.round(gross);
  }

  const ded = computeDeductions(gross);
  const net = gross - ded.totalDed;

  applyValuesToUI(gross, ded, net);
}

function applyValuesToUI(gross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax').checked;
  const taxPercent = getSelectedTaxPercent();
  
  document.getElementById('lblIt').innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';

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
    extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '입력 세전 급여';
    extraRow.classList.add('hidden');
  }

  const resultBox = document.getElementById('resultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
