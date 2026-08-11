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

  // tabBtns.forEach(btn => {
  //   btn.addEventListener('click', (e) => {
  //     tabBtns.forEach(b => b.classList.remove('active'));
  //     e.target.classList.add('active');
  //     currentMode = e.target.getAttribute('data-mode');

  //     if (amountLabel) {
  //       amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (과세 대상) (원)';
  //     }

  //     updateTaxRateGroupVisibility();
  //   });
  // });

// 탭 버튼 클릭 이벤트 (오류 방지 보정판)
tabBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // 1. 버튼 내부 텍스트 클릭 시에도 정확히 .tab-btn 요소를 찾도록 보정
    const targetBtn = e.target.closest('.tab-btn') || e.currentTarget;
    if (!targetBtn) return;

    // 2. 모든 탭에서 active 클래스 제거 후 클릭된 탭에 추가
    tabBtns.forEach(b => b.classList.remove('active'));
    targetBtn.classList.add('active');

    // 3. currentMode 모드 값 추출
    currentMode = targetBtn.getAttribute('data-mode') || 'GROSS_TO_NET';

    // 4. 라벨 및 플레이스홀더 변경 (Null 체크로 스크립트 멈춤 방지)
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

    // 5. 소득세 비율 관련 그룹 숨김/노출 함수 실행
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
 * 💡 소득세 산출 컨트롤러 (taxTable.js 매핑 후 예외 구간 시 홈택스 공식 산식 호출)
 */
function getIncomeTax(baseSalary, dependents = 1, taxRatePercent = 100) {
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = null;

  // 1. taxTable.js 파일의 테이블 룩업 조회 (1순위)
  if (typeof lookupNtsTaxTable === 'function') {
    baseTax = lookupNtsTaxTable(baseSalary, dependents);
  }

  // 2. 테이블 매핑 데이터가 없는 구간은 홈택스 정밀 공식 산식으로 보정 (2순위)
  if (baseTax === null) {
    baseTax = calculateNtsFormulaTax(baseSalary, dependents);
  }

  // 원천징수 비율 반영 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 국세청 홈택스 정밀 자동계산 공식 산식 (테이블 외 구간 대응용)
 */
function calculateNtsFormulaTax(baseSalary, dependents) {
  const Y = baseSalary * 12;

  let E = 0;
  if (Y <= 5000000) E = Y * 0.7;
  else if (Y <= 15000000) E = 3500000 + (Y - 5000000) * 0.4;
  else if (Y <= 45000000) E = 7500000 + (Y - 15000000) * 0.15;
  else if (Y <= 100000000) E = 12000000 + (Y - 45000000) * 0.05;
  else E = 14750000 + (Y - 100000000) * 0.02;

  const I = Y - E;
  const P = dependents * 1500000;
  const pensionBase = Math.max(RATES_CONFIG.NP.MIN_BASE, Math.min(baseSalary, RATES_CONFIG.NP.MAX_BASE));
  const N = Math.floor(pensionBase * 0.045) * 12;

  let S = 0;
  if (dependents === 1) {
    if (Y <= 30000000) S = 3100000 + (Y * 0.04);
    else if (Y <= 45000000) S = 3100000 + (Y * 0.04) - ((Y - 30000000) * 0.05);
    else if (Y <= 70000000) S = 3100000 + (Y * 0.015);
    else if (Y <= 120000000) S = 3100000 + (Y * 0.005);
    else S = 3100000;
  } else {
    if (Y <= 30000000) S = 3600000 + (Y * 0.04);
    else if (Y <= 45000000) S = 3600000 + (Y * 0.04) - ((Y - 30000000) * 0.05);
    else if (Y <= 70000000) S = 3600000 + (Y * 0.02);
    else if (Y <= 120000000) S = 3600000 + (Y * 0.01);
    else S = 3600000;
  }

  const taxBase = Math.max(0, I - P - N - S);

  let calcTax = 0;
  if (taxBase <= 14000000) calcTax = taxBase * 0.06;
  else if (taxBase <= 50000000) calcTax = 840000 + (taxBase - 14000000) * 0.15;
  else if (taxBase <= 88000000) calcTax = 6240000 + (taxBase - 50000000) * 0.24;
  else if (taxBase <= 150000000) calcTax = 15360000 + (taxBase - 88000000) * 0.35;
  else calcTax = 37060000 + (taxBase - 150000000) * 0.38;

  let taxCredit = calcTax <= 500000 ? calcTax * 0.55 : 275000 + (calcTax - 500000) * 0.30;
  let taxCreditLimit = Y <= 33000000 ? 740000 : Math.max(660000, 740000 - (Y - 33000000) * 0.008);
  taxCredit = Math.min(taxCredit, taxCreditLimit);

  const finalTax = Math.max(0, calcTax - taxCredit);
  return Math.floor(finalTax / 12 / 10) * 10;
}

/**
 * 과세 기본급(baseSalary) 기준 4대보험 및 세금 공제 항목 산출
 * (taxTable.js의 RATES_CONFIG 전역 객체 참조)
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