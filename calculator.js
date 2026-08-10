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
   * 💡 계산 모드 및 체크박스 상태에 따른 소득세율 옵션 그룹 숨김(hidden) 제어 함수
   */
  function updateTaxRateGroupVisibility() {
    if (!taxRateGroup) return;

    const isTaxChecked = chkTax ? chkTax.checked : true;

    if (currentMode === 'GROSS_TO_NET') {
      // Gross->Net 모드일 때는 소득세율 비율 선택 옵션을 완전히 숨기고(hidden) 비활성화
      taxRateGroup.style.display = 'none';
      if (taxRateSelect) taxRateSelect.disabled = true;
      if (taxRateCustom) taxRateCustom.disabled = true;
    } else {
      // Net->Gross 모드일 때는 소득세 체크박스 유무에 맞춰 노출 및 활성화
      taxRateGroup.style.display = isTaxChecked ? 'block' : 'none';
      if (taxRateSelect) taxRateSelect.disabled = false;
      if (taxRateCustom) taxRateCustom.disabled = false;
    }
  }

  // 소득세 공제 체크박스 이벤트
  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      updateTaxRateGroupVisibility();
    });
  }

  // 소득세 원천징수 비율 선택 드롭다운 제어
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

  // 상단 탭 버튼 클릭 이벤트 (계산 모드 전환)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      // 입력 라벨 변경
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (과세 대상) (원)';
      }

      // 모드 변경 시 세율 박스 hidden 상태 즉시 업데이트
      updateTaxRateGroupVisibility();
    });
  });

  // 금액 천단위 콤마 자동 포맷터 연동
  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  // 초기 상태 세팅 실행
  updateTaxRateGroupVisibility();

  // 계산하기 버튼 실행
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      calculate();
    });
  }
});

/**
 * 소득세 원천징수 비율 값 가져오기
 * 💡 Gross->Net 모드일 경우 국세청 100% 간이세액표 정밀 산식을 무조건 적용
 */
function getSelectedTaxPercent() {
  const chkTax = document.getElementById('chkTax');
  if (!chkTax || !chkTax.checked) return 0;

  // Gross->Net 모드에서는 무조건 100% (국세청 정밀 간이세액표) 적용
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
 * 💡 국세청 근로소득 간이세액표 정밀 세액 산출 함수 (WEHAGO 세액 일치)
 * @param {number} baseSalary - 과세 대상 기본급
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 선택 비율 (Gross->Net은 100% 고정)
 * @returns {number} 산출 소득세 (10원 단위 절사)
 */
function getIncomeTax(baseSalary, dependents = 1, taxRatePercent = 100) {
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = 0;

  // 국세청 근로소득 간이세액표 2026 개정 구간 산식
  if (baseSalary <= 1500000) {
    baseTax = (baseSalary - 1060000) * 0.06 * 0.55;
  } else if (baseSalary <= 2000000) {
    baseTax = 14520 + (baseSalary - 1500000) * 0.15 * 0.55;
  } else if (baseSalary <= 3000000) {
    baseTax = 55770 + (baseSalary - 2000000) * 0.15 * 0.70;
  } else if (baseSalary <= 4000000) {
    baseTax = 160770 + (baseSalary - 3000000) * 0.15 * 0.80;
  } else if (baseSalary <= 5000000) {
    baseTax = 280770 + (baseSalary - 4000000) * 0.24 * 0.80;
  } else {
    baseTax = 472770 + (baseSalary - 5000000) * 0.35 * 0.80;
  }

  // 부양가족 수 1인 초과 시 차감 공제
  if (dependents > 1) {
    const familyDeduction = (dependents - 1) * 12500;
    baseTax = Math.max(0, baseTax - familyDeduction);
  }

  // 원천징수 비율 연산 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 과세 기본급(baseSalary) 기준 4대보험 및 세금 공제 항목 산출
 * @param {number} baseSalary - 과세 대상 기본급
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
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE); // 지방소득세 = 소득세의 10%
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

/**
 * 메인 계산 연산 함수
 */
function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let totalGross = 0; // 총 세전 지급액 (기본급 + 비과세)
  let baseSalary = 0; // 과세 대상 기본급
  let ded = {};
  let net = 0;

  if (currentMode === 'GROSS_TO_NET') {
    /**
     * [Gross->Net (세전->세후)]
     * 기본급(amount)을 과세표준으로 사용하고, 국세청 100% 간이세액표 정밀 산출을 직통 연결
     */
    baseSalary = amount;
    totalGross = baseSalary + taxFree;

    ded = computeDeductions(baseSalary);
    net = totalGross - ded.totalDed;
  } else {
    /**
     * [Net->Gross (실수령액 세후 -> 세전 역산)]
     * 선택된 소득세율을 반영하여 목표 실수령액(amount)을 맞추는 이분 탐색
     */
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

/**
 * 계산 결과값을 UI 카드 요소에 바인딩
 */
function applyValuesToUI(totalGross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  // 소득세 안내 라벨 세팅
  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    if (currentMode === 'GROSS_TO_NET') {
      lblIt.innerText = isTaxChecked ? '소득세 (국세청 간이세액)' : '소득세 (미적용)';
    } else {
      lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
    }
  }

  // 총 세전 금액 및 차액 표시
  document.getElementById('resMainAmount').innerText = fmt(totalGross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  // 4대보험 및 세금 수치 반영
  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  // 총 공제합계 및 예상 실수령액
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
