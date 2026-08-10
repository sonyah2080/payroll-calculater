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

  // 소득세 옵션 표시 토글
  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      if (taxRateGroup) taxRateGroup.style.display = show ? 'block' : 'none';
    });
  }

  // 소득세 원천징수 비율 선택 드롭다운
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

  // 상단 탭 버튼 클릭 이벤트
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (과세 대상) (원)';
      }
    });
  });

  // 금액 천단위 콤마 자동 생성 포맷터
  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  // 계산하기 버튼 실행
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      calculate();
    });
  }
});

/**
 * 소득세 원천징수 비율 가져오기
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
 * 💡 국세청 근로소득 간이세액표 산식 정밀 구현 함수
 * @param {number} baseSalary - 기본급 (과세 대상 금액)
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 선택 비율 (100, 80, 50 등)
 * @returns {number} 산출 소득세 (10원 단위 절사)
 */
function getIncomeTax(baseSalary, dependents = 1, taxRatePercent = 100) {
  // 과세급여 106만 원 이하 소액부징수 (0원)
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

  // 선택한 원천징수 비율(100%, 80%, 50% 등) 연산 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 과세 기본급(baseSalary) 기준으로 4대보험 및 세금 공제액 항목별 산출
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
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE); // 지방소득세는 소득세의 10%
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
     * 기본급 2,300,000원이 과세 대상(baseSalary)으로 정밀 산출에 들어가고,
     * 비과세 150,000원은 공제 없이 총지급액(totalGross)에 합산됩니다.
     */
    baseSalary = amount;
    totalGross = baseSalary + taxFree;

    ded = computeDeductions(baseSalary);
    net = totalGross - ded.totalDed;
  } else {
    /**
     * [Net->Gross (세후->세전 역산)]
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
 * 연산 결과를 UI 카드 요소에 바인딩
 */
function applyValuesToUI(totalGross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
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
