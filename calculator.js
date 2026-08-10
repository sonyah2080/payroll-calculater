/**
 * ============================================================================
 * 4대보험 및 세금 요율 설정 (2026년 기준 최신 개정 요율)
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

// 현재 활성화된 계산 모드 ('NET_TO_GROSS': 실수령액->세전, 'GROSS_TO_NET': 세전->실수령액)
let currentMode = 'NET_TO_GROSS';

/**
 * 페이지 로드 시 이벤트 리스너 세팅
 */
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

  // 소득세 관련 옵션 박스 토글
  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      if (taxRateGroup) taxRateGroup.style.display = show ? 'block' : 'none';
    });
  }

  // 소득세 직접 입력 드롭다운 제어
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

  // 상단 탭 버튼 클릭 이벤트 (모드 전환 시 입력 라벨 명칭 변경)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      // 💡 모드에 따른 라벨 명확화
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '기본급 (과세 대상) (원)';
      }
    });
  });

  // 금액 3자리 마다 콤마(,) 연동
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
 * 💡 국세청 근로소득 간이세액표 정밀 세액 계산 함수 (GROSS_TO_NET 전용)
 * @param {number} baseSalary - 기본급 (과세 대상 급여)
 * @param {number} dependents - 공제대상 가족수
 * @param {number} taxRatePercent - 원천징수 선택 비율
 */
function getIncomeTaxNts(baseSalary, dependents = 1, taxRatePercent = 100) {
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = 0;

  // 국세청 간이세액표 과세표준 구간별 정밀 산식
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

  // 공제대상 가족수 1인 초과 시 추가 차감
  if (dependents > 1) {
    const familyDeduction = (dependents - 1) * 12500;
    baseTax = Math.max(0, baseTax - familyDeduction);
  }

  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 기존 단순 소득세 계산 함수 (NET_TO_GROSS 역산용)
 */
function getIncomeTaxSimple(baseSalary, dependents = 1, taxRatePercent = 100) {
  if (baseSalary <= 1060000 || taxRatePercent <= 0) return 0;

  let base = Math.max(0, baseSalary - (dependents - 1) * 100000);
  let rawIt = 0;

  if (base <= 1060000) rawIt = 0;
  else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
  else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
  else rawIt = 320000 + (base - 5000000) * 0.22;

  return floor10(rawIt * (taxRatePercent / 100));
}

/**
 * 순수 과세 기본급(baseSalary) 기준으로 4대보험 및 세금 공제액 항목별 산출
 * @param {number} baseSalary - 기본급 (보수월액)
 * @param {boolean} useNtsTax - 국세청 정밀 산식 적용 여부
 */
function computeDeductions(baseSalary, useNtsTax = false) {
  const dependentsInput = document.getElementById('dependents');
  const dependents = parseInt(dependentsInput ? dependentsInput.value : 1, 10) || 1;

  const isNpChecked = document.getElementById('chkNp')?.checked ?? false;
  const isHiChecked = document.getElementById('chkHi')?.checked ?? false;
  const isEiChecked = document.getElementById('chkEi')?.checked ?? false;
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;

  // 1. 국민연금: 기본급 * 4.75% (상/하한선 적용 및 10원 절사)
  const npBase = Math.min(Math.max(baseSalary, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험: 기본급 * 3.595% (10원 절사)
  const hi = isHiChecked ? floor10(baseSalary * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험: 산출된 건강보험료 * 13.14% (10원 절사)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험: 기본급 * 0.9% (10원 절사)
  const ei = isEiChecked ? floor10(baseSalary * RATES_CONFIG.EI.RATE) : 0;

  // 5. 소득세 및 지방소득세 산출
  let it = 0;
  let localTax = 0;

  if (isTaxChecked) {
    if (useNtsTax) {
      it = getIncomeTaxNts(baseSalary, dependents, getSelectedTaxPercent());
    } else {
      it = getIncomeTaxSimple(baseSalary, dependents, getSelectedTaxPercent());
    }
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE);
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
     * 💡 [Gross->Net (세전->세후)]
     * 1. 첫 번째 입력창의 금액(amount) = 과세 기본급(2,300,000원)
     * 2. 두 번째 입력창의 금액(taxFree) = 비과세 수당(150,000원)
     * 3. 4대보험 및 소득세 = 기본급(2,300,000원)을 기준으로만 정확히 공제
     * 4. 총 세전 지급액 = 기본급(2,300,000) + 비과세(150,000) = 2,450,000원
     */
    baseSalary = amount;
    totalGross = baseSalary + taxFree;

    // 국세청 정밀 산식 적용
    ded = computeDeductions(baseSalary, true);
    net = totalGross - ded.totalDed;
  } else {
    /**
     * [Net->Gross (세후->세전 역산)]
     * 목표 실수령액(amount)을 맞추기 위한 기본급(baseSalary) 이분 탐색
     */
    let low = Math.max(0, amount - taxFree);
    let high = amount * 2.0;

    for (let i = 0; i < 50; i++) {
      baseSalary = (low + high) / 2;
      ded = computeDeductions(baseSalary, false);
      
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
    ded = computeDeductions(baseSalary, false);
    net = totalGross - ded.totalDed;
  }

  // 화면 UI에 데이터 표시
  applyValuesToUI(totalGross, ded, net);
}

/**
 * 계산 결과값을 화면 카드 요소에 반영
 */
function applyValuesToUI(totalGross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  // 소득세 안내 라벨 세팅
  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
  }

  // 총 세전 금액 및 공제 차액 표시
  document.getElementById('resMainAmount').innerText = fmt(totalGross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  // 4대보험 및 세금 항목별 금액 반영
  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  // 총 공제합계 및 예상 실수령액 반영
  document.getElementById('resDeduction').innerText = fmt(ded.totalDed);
  document.getElementById('resNetAmount').innerText = fmt(net);

  // 결과 상단 타이틀 명칭 정리
  const extraRow = document.getElementById('extraRow');

  if (currentMode === 'NET_TO_GROSS') {
    document.getElementById('resMainTitle').innerText = '예상 총 지급액';
    if (extraRow) extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '총 세전 지급액 (기본급+비과세)';
    if (extraRow) extraRow.classList.add('hidden');
  }

  // 결과 박스 포커스
  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
