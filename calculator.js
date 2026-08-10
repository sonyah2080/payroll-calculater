/**
 * ============================================================================
 * 4대보험 및 세금 요율 설정 (2026년 최신 개정 요율)
 * ============================================================================
 */
const RATES_CONFIG = {
  // 국민연금 (2026년 근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,   // 국민연금 기준소득월액 하한선
    MAX_BASE: 6170000   // 국민연금 기준소득월액 상한선
  },
  // 건강보험 (2026년 근로자 부담분 3.595%)
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

// 현재 계산 모드 ('NET_TO_GROSS': 실수령액->세전, 'GROSS_TO_NET': 세전->실수령액)
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

  /**
   * Gross->Net 모드일 때 소득세 원천징수 비율 선택 박스 숨김(hidden) 제어
   */
  function updateTaxRateGroupVisibility() {
    if (!taxRateGroup) return;

    const isTaxChecked = chkTax ? chkTax.checked : true;

    if (currentMode === 'GROSS_TO_NET') {
      taxRateGroup.style.display = 'none';
      if (taxRateSelect) taxRateSelect.disabled = true;
      if (taxRateCustom) taxRateCustom.disabled = true;
    } else {
      taxRateGroup.style.display = isTaxChecked ? 'block' : 'none';
      if (taxRateSelect) taxRateSelect.disabled = false;
      if (taxRateCustom) taxRateCustom.disabled = false;
    }
  }

  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      updateTaxRateGroupVisibility();
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
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (과세 대상) (원)';
      }

      updateTaxRateGroupVisibility();
    });
  });

  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  updateTaxRateGroupVisibility();

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

  // Gross->Net 모드에서는 무조건 100% 국세청 간이세액표 적용
  if (currentMode === 'GROSS_TO_NET') {
    return 100;
  }

  const selectVal = document.getElementById('taxRateSelect').value;
  if (selectVal === 'custom') {
    return parseFloat(document.getElementById('taxRateCustom').value) || 0;
  }
  return parseFloat(selectVal) || 0;
}

/**
 * 📄 2026.03.01 개정 국세청 근로소득 간이세액표 공식 정밀 구현
 * @param {number} baseSalary - 과세 대상 기본급 (보수월액)
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 비율 (%)
 */
function getIncomeTax(baseSalary, dependents = 1, taxRatePercent = 100) {
  // 월 과세급여 106만 원 이하 소액부징수
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  // 1. 연간 총급여액 산정
  const annualGross = baseSalary * 12;

  // 2. 근로소득공제 연산
  let earnedIncomeDeduction = 0;
  if (annualGross <= 5000000) {
    earnedIncomeDeduction = annualGross * 0.70;
  } else if (annualGross <= 15000000) {
    earnedIncomeDeduction = 3500000 + (annualGross - 5000000) * 0.40;
  } else if (annualGross <= 45000000) {
    earnedIncomeDeduction = 7500000 + (annualGross - 15000000) * 0.15;
  } else if (annualGross <= 100000000) {
    earnedIncomeDeduction = 12000000 + (annualGross - 45000000) * 0.05;
  } else {
    earnedIncomeDeduction = 14750000 + (annualGross - 100000000) * 0.02;
  }

  // 근로소득금액 = 연총급여액 - 근로소득공제
  const earnedIncomeAmount = annualGross - earnedIncomeDeduction;

  // 3. 인적공제 (본인 및 부양가족 1인당 150만 원)
  const personalDeduction = dependents * 1500000;

  // 4. 연금보험료공제 (국민연금 근로자 부담분 연간액)
  const npBase = Math.min(Math.max(baseSalary, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const pensionDeduction = floor10(npBase * RATES_CONFIG.NP.RATE) * 12;

  // 5. [PDF 반영] 특별소득공제 및 특별세액공제 중 일부 산식 (제1호 규정)
  let specialDeduction = 0;
  if (annualGross <= 30000000) {
    if (dependents === 1) specialDeduction = 3100000 + annualGross * 0.04;
    else if (dependents === 2) specialDeduction = 3600000 + annualGross * 0.04;
    else specialDeduction = 5000000 + annualGross * 0.07;
  } else if (annualGross <= 45000000) {
    const over30m = annualGross - 30000000;
    if (dependents === 1) specialDeduction = 3100000 + annualGross * 0.04 - over30m * 0.05;
    else if (dependents === 2) specialDeduction = 3600000 + annualGross * 0.04 - over30m * 0.05;
    else specialDeduction = 5000000 + annualGross * 0.07 - over30m * 0.05;
  } else if (annualGross <= 70000000) {
    if (dependents === 1) specialDeduction = 3100000 + annualGross * 0.015;
    else if (dependents === 2) specialDeduction = 3600000 + annualGross * 0.020;
    else specialDeduction = 5000000 + annualGross * 0.050;
  } else if (annualGross <= 120000000) {
    const over40m = annualGross - 40000000;
    if (dependents === 1) specialDeduction = 3100000 + annualGross * 0.005;
    else if (dependents === 2) specialDeduction = 3600000 + annualGross * 0.010;
    else specialDeduction = 5000000 + annualGross * 0.030 + over40m * 0.04;
  }

  // 6. 종합소득 과세표준 연산
  const taxStandard = Math.max(0, earnedIncomeAmount - personalDeduction - pensionDeduction - specialDeduction);

  // 7. 기본 산출세액 연산 (소득세 기본세율)
  let calculatedTax = 0;
  if (taxStandard <= 14000000) {
    calculatedTax = taxStandard * 0.06;
  } else if (taxStandard <= 50000000) {
    calculatedTax = 840000 + (taxStandard - 14000000) * 0.15;
  } else if (taxStandard <= 88000000) {
    calculatedTax = 6240000 + (taxStandard - 50000000) * 0.24;
  } else if (taxStandard <= 150000000) {
    calculatedTax = 15360000 + (taxStandard - 88000000) * 0.35;
  } else {
    calculatedTax = 37060000 + (taxStandard - 150000000) * 0.38;
  }

  // 8. 근로소득세액공제 산정
  let taxCredit = 0;
  if (calculatedTax <= 1300000) {
    taxCredit = calculatedTax * 0.55;
  } else {
    taxCredit = 715000 + (calculatedTax - 1300000) * 0.30;
  }

  // 근로소득세액공제 한도 적용 (총급여 3.3천만 이하 74만, 7천만 이하 74만~66만, 초과 66만~50만)
  let maxCredit = 740000;
  if (annualGross > 33000000 && annualGross <= 70000000) {
    maxCredit = Math.max(660000, 740000 - (annualGross - 33000000) * 0.008);
  } else if (annualGross > 70000000) {
    maxCredit = Math.max(500000, 660000 - (annualGross - 70000000) * 0.5 * 0.008);
  }
  taxCredit = Math.min(taxCredit, maxCredit);

  // 9. 연간 결정세액 -> 월 소득세 산출 (10원 단위 절사)
  const annualFinalTax = Math.max(0, calculatedTax - taxCredit);
  const monthlyTax = annualFinalTax / 12;

  // 원천징수 요율 반영 후 절사
  return floor10(monthlyTax * (taxRatePercent / 100));
}

/**
 * 과세 기본급(baseSalary) 기준 4대보험 및 세금 공제 항목 산출
 */
function computeDeductions(baseSalary) {
  const dependentsInput = document.getElementById('dependents');
  const dependents = parseInt(dependentsInput ? dependentsInput.value : 1, 10) || 1;

  const isNpChecked = document.getElementById('chkNp')?.checked ?? false;
  const isHiChecked = document.getElementById('chkHi')?.checked ?? false;
  const isEiChecked = document.getElementById('chkEi')?.checked ?? false;
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;

  // 1. 국민연금 (4.75%)
  const npBase = Math.min(Math.max(baseSalary, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험 (3.595%)
  const hi = isHiChecked ? floor10(baseSalary * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험 (건강보험료의 13.14%)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험 (0.9%)
  const ei = isEiChecked ? floor10(baseSalary * RATES_CONFIG.EI.RATE) : 0;

  // 5. 소득세 및 지방소득세 산출
  let it = 0;
  let localTax = 0;

  if (isTaxChecked) {
    it = getIncomeTax(baseSalary, dependents, getSelectedTaxPercent());
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let totalGross = 0;
  let baseSalary = 0;
  let ded = {};
  let net = 0;

  if (currentMode === 'GROSS_TO_NET') {
    baseSalary = amount;
    totalGross = baseSalary + taxFree;

    ded = computeDeductions(baseSalary);
    net = totalGross - ded.totalDed;
  } else {
    let low = Math.max(0, amount - taxFree);
    let high = amount * 2.0;

    for (let i = 0; i < 50; i++) {
      baseSalary = (low + high) / 2;
      ded = computeDeductions(baseSalary);
      
      const calcNet = (baseSalary + taxFree) - ded.totalDed;

      if (Math.abs(calcNet - amount) < 0.1) break;

      if (calcNet < amount) {
        low = baseSalary;
      } else {
        high = baseSalary;
      }
    }

    baseSalary = Math.round(baseSalary);
    totalGross = baseSalary + taxFree;
    ded = computeDeductions(baseSalary);
    net = totalGross - ded.totalDed;
  }

  applyValuesToUI(totalGross, ded, net);
}

function applyValuesToUI(totalGross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    if (currentMode === 'GROSS_TO_NET') {
      lblIt.innerText = isTaxChecked ? '소득세 (국세청 간이세액)' : '소득세 (미적용)';
    } else {
      lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
    }
  }

  document.getElementById('resMainAmount').innerText = fmt(totalGross);
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
    document.getElementById('resMainTitle').innerText = '예상 총 지급액';
    if (extraRow) extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '총 세전 지급액 (기본급+비과세)';
    if (extraRow) extraRow.classList.add('hidden');
  }

  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
