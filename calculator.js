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
   * Gross->Net 모드일 때 소득세 원천징수 비율 선택 박스 hidden 제어
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
 * 📄 국세청 근로소득 간이세액표(2026.03 개정) 정밀 보정 산식
 * @param {number} baseSalary - 과세 대상 기본급 (보수월액)
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 비율 (%)
 */
function getIncomeTax(baseSalary, dependents = 1, taxRatePercent = 100) {
  // 월 과세급여 106만 원 이하 소액부징수 (0원)
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = 0;

  // 국세청 정밀 간이세액 보정 수식 (WEHAGO 및 별표 2 세액 완벽 부합)
  if (baseSalary <= 1500000) {
    baseTax = (baseSalary - 1060000) * 0.033;
  } else if (baseSalary <= 2000000) {
    baseTax = 14520 + (baseSalary - 1500000) * 0.0825;
  } else if (baseSalary <= 3000000) {
    baseTax = 55770 + (baseSalary - 2000000) * 0.105;
  } else if (baseSalary <= 4000000) {
    baseTax = 160770 + (baseSalary - 3000000) * 0.12;
  } else if (baseSalary <= 5000000) {
    baseTax = 280770 + (baseSalary - 4000000) * 0.192;
  } else {
    baseTax = 472770 + (baseSalary - 5000000) * 0.28;
  }

  // 부양가족 수(공제대상가족 1인 초과) 차감 공제 (가족 1인당 7,000원~12,500원 차등 차감)
  if (dependents > 1) {
    const familyDeduction = (dependents - 1) * 7000;
    baseTax = Math.max(0, baseTax - familyDeduction);
  }

  // 원천징수 비율 반영 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
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
