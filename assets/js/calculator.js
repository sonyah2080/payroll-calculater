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

  // 탭 버튼 클릭 이벤트 (오류 방지 보정판)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.tab-btn') || e.currentTarget;
      if (!targetBtn) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');

      currentMode = targetBtn.getAttribute('data-mode') || 'GROSS_TO_NET';

      if (amountLabel) {
        amountLabel.innerText = (currentMode === 'NET_TO_GROSS') 
          ? '목표 실수령액 (원)' 
          : '기본 급여 (원)';
      }

      if (amountInput) {
        amountInput.placeholder = (currentMode === 'NET_TO_GROSS') 
          ? '총 지급액 입력' 
          : '기본급(과세) 금액 입력';
      }

      if (typeof updateTaxRateGroupVisibility === 'function') {
        updateTaxRateGroupVisibility();
      }
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
 * 💡 과세 기본급(baseSalary) 기준 4대보험 및 세금 공제 항목 산출
 * (taxTable.js의 RATES_CONFIG 및 getIncomeTax 함수와 완벽 연동)
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
    // 🔥 taxTable.js의 마스터 함수를 바로 호출하여 기본 100% 소득세 확보
    const baseTax = getIncomeTax(baseSalary, dependents);
    const taxRatePercent = getSelectedTaxPercent(); // 80%, 100%, 120% 등 비율 가져오기
    
    // 원천징수 비율을 곱한 후 10원 단위 절사
    it = floor10(baseTax * (taxRatePercent / 100));
    // 지방소득세는 소득세의 10%
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

/**
 * =========================================================================
 * [1] 그로스 넷 전용 함수: 세전 -> 세후 (Gross -> Net)
 * =========================================================================
 */
function calculateGrossToNet(grossSalary, taxFree) {
  const baseSalary = grossSalary;            // 과세 대상 기본급
  const totalGross = baseSalary + taxFree;   // 총 세전 지급액
  const ded = computeDeductions(baseSalary); // 공제액 산출
  const net = totalGross - ded.totalDed;     // 실수령액

  return { totalGross, ded, net };
}

/**
 * =========================================================================
 * [2] 넷 그로스 전용 함수: 세후 -> 세전 역산 (Net -> Gross)
 * =========================================================================
 */
function calculateNetToGross(targetNet, taxFree) {
  let low = Math.max(0, targetNet - taxFree);
  let high = targetNet * 2.0;
  let baseSalary = 0;
  let ded = {};

  for (let i = 0; i < 50; i++) {
    baseSalary = (low + high) / 2;
    ded = computeDeductions(baseSalary);

    const calculatedNet = (baseSalary + taxFree) - ded.totalDed;

    if (Math.abs(calculatedNet - targetNet) < 0.1) break;

    if (calculatedNet < targetNet) {
      low = baseSalary;
    } else {
      high = baseSalary;
    }
  }

  baseSalary = Math.round(baseSalary);
  const totalGross = baseSalary + taxFree;
  ded = computeDeductions(baseSalary);
  const net = totalGross - ded.totalDed;

  return { totalGross, ded, net };
}

/**
 * =========================================================================
 * [3] 메인 계산 실행기
 * =========================================================================
 */
function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let result;

  if (currentMode === 'GROSS_TO_NET') {
    result = calculateGrossToNet(amount, taxFree);
  } else {
    result = calculateNetToGross(amount, taxFree);
  }

  applyValuesToUI(result.totalGross, result.ded, result.net);
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