/**
 * ============================================================================
 * 4대보험 및 세금 요율 설정 (2026년 기준 최신 개정 요율)
 * - 세법 및 사회보험 요율 개정 시 최상단 이 객체 값만 고치면 일괄 반영됩니다.
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
 * 페이지 로드 시 이벤트 리스너 및 초기화 세팅
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

  // 소득세 체크박스 선택 시 관련 옵션(부양가족, 비율) 표시/숨김
  if (chkTax) {
    chkTax.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (dependentsGroup) dependentsGroup.style.display = show ? 'block' : 'none';
      if (taxRateGroup) taxRateGroup.style.display = show ? 'block' : 'none';
    });
  }

  // 소득세 원천징수 비율 선택 드롭다운 (직접 입력 선택 시 입력창 노출)
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

  // 상단 탭 버튼 클릭 이벤트 (Net->Gross / Gross->Net 모드 전환)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      
      // 입력 라벨 명칭 변경 (사용자 직관성에 맞게)
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '세전 총급여 (원)';
      }
    });
  });

  // 금액 3자리 마다 콤마(,) 자동 생성 포맷터 연동
  if (typeof attachFormatter === 'function') {
    if (amountInput) attachFormatter(amountInput);
    if (taxFreeInput) attachFormatter(taxFreeInput);
  }

  // 계산하기 버튼 실행 이벤트
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      calculate();
    });
  }
});

/**
 * UI 선택 박스에서 소득세 원천징수 비율(%) 값 가져오기
 * @returns {number} 선택된 원천징수 비율 (예: 100, 80, 50 등)
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
 * @param {number} taxable - 과세 대상 급여 (세전 총급여 - 비과세)
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 선택 비율 (100%, 80%, 50% 등)
 * @returns {number} 산출된 소득세 (10원 단위 절사)
 */
function getIncomeTaxNts(taxable, dependents = 1, taxRatePercent = 100) {
  // 월 과세급여 106만 원 이하 소액부징수 (0원)
  if (taxable <= 1060000 || taxRatePercent <= 0) return 0;

  let baseTax = 0;

  // 국세청 근로소득 간이세액표 구간별 세액 계산 정밀 산식
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

  // 부양가족 수(공제대상가족 1인 초과 시) 추가 차감 공제
  if (dependents > 1) {
    const familyDeduction = (dependents - 1) * 12500;
    baseTax = Math.max(0, baseTax - familyDeduction);
  }

  // 소득세 원천징수 비율 적용 및 10원 단위 절사
  const finalTax = baseTax * (taxRatePercent / 100);
  return floor10(finalTax);
}

/**
 * 기존 단순 소득세 계산 함수 (NET_TO_GROSS 역산용)
 * @param {number} taxable - 과세 대상 급여
 * @param {number} dependents - 공제대상 가족수 (본인 포함)
 * @param {number} taxRatePercent - 원천징수 선택 비율
 * @returns {number} 산출된 소득세
 */
function getIncomeTaxSimple(taxable, dependents = 1, taxRatePercent = 100) {
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
 * 순수 과세급여(taxable) 기준으로 4대보험 및 세금 공제액 항목별 산출
 * @param {number} taxable - 보수월액 (과세 대상 금액)
 * @param {boolean} useNtsTax - 국세청 정밀 산식 사용 여부
 * @returns {object} 항목별 공제액 및 총 공제합계 객체
 */
function computeDeductions(taxable, useNtsTax = false) {
  const dependentsInput = document.getElementById('dependents');
  const dependents = parseInt(dependentsInput ? dependentsInput.value : 1, 10) || 1;

  const isNpChecked = document.getElementById('chkNp')?.checked ?? false;
  const isHiChecked = document.getElementById('chkHi')?.checked ?? false;
  const isEiChecked = document.getElementById('chkEi')?.checked ?? false;
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;

  // 1. 국민연금 산출: 보수월액 * 4.75% (상/하한선 제한 및 10원 단위 절사)
  const npBase = Math.min(Math.max(taxable, RATES_CONFIG.NP.MIN_BASE), RATES_CONFIG.NP.MAX_BASE);
  const np = isNpChecked ? floor10(npBase * RATES_CONFIG.NP.RATE) : 0;

  // 2. 건강보험 산출: 보수월액 * 3.595% (10원 단위 절사)
  const hi = isHiChecked ? floor10(taxable * RATES_CONFIG.HI.RATE) : 0;

  // 3. 장기요양보험 산출: 산출된 건강보험료 * 13.14% (10원 단위 절사)
  const lt = isHiChecked ? floor10(hi * RATES_CONFIG.LT.RATE_OF_HI) : 0;

  // 4. 고용보험 산출: 보수월액 * 0.9% (10원 단위 절사)
  const ei = isEiChecked ? floor10(taxable * RATES_CONFIG.EI.RATE) : 0;

  // 5. 소득세 및 지방소득세 산출
  let it = 0;
  let localTax = 0;

  if (isTaxChecked) {
    // GROSS_TO_NET 모드일 때만 국세청 간이세액표 정밀 산식(getIncomeTaxNts) 적용
    if (useNtsTax) {
      it = getIncomeTaxNts(taxable, dependents, getSelectedTaxPercent());
    } else {
      it = getIncomeTaxSimple(taxable, dependents, getSelectedTaxPercent());
    }
    localTax = floor10(it * RATES_CONFIG.LOCAL_TAX.RATE); // 지방소득세는 소득세의 10%
  }

  // 총 공제합계 연산
  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

/**
 * 급여 메인 연산 및 모드별 처리 함수
 */
function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);

  let gross = 0;   // 총 세전 급여 (과세 + 비과세)
  let taxable = 0; // 공제 기준 순수 과세 금액 (보수월액)
  let ded = {};
  let net = 0;

  if (currentMode === 'GROSS_TO_NET') {
    /**
     * [Gross->Net (세전 -> 세후)]
     * 국세청 간이세액표 정밀 산식(useNtsTax = true)을 적용하여 WEHAGO 결과와 일치시킴
     */
    gross = amount;
    taxable = Math.max(0, gross - taxFree);

    // 두 번째 인자로 true를 넘겨 국세청 산식 적용
    ded = computeDeductions(taxable, true);
    net = gross - ded.totalDed;
  } else {
    /**
     * [Net->Gross (세후 -> 세전 역산)]
     * 기존 역산 방식 적용
     */
    let low = Math.max(0, amount - taxFree);
    let high = amount * 2.0;

    for (let i = 0; i < 50; i++) {
      taxable = (low + high) / 2;
      ded = computeDeductions(taxable, false);
      
      // 계산된 실수령액 = (과세 금액 + 비과세) - 총 공제합계
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
    ded = computeDeductions(taxable, false);
    net = gross - ded.totalDed;
  }

  // UI 화면에 결과값 바인딩
  applyValuesToUI(gross, ded, net);
}

/**
 * 계산 결과값을 화면 카드 및 UI 요소에 반영
 * @param {number} gross - 총 세전 급여
 * @param {object} ded - 항목별 공제액 객체
 * @param {number} net - 최종 실수령액
 */
function applyValuesToUI(gross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax')?.checked ?? false;
  const taxPercent = getSelectedTaxPercent();

  // 소득세 안내 라벨 상태 업데이트
  const lblIt = document.getElementById('lblIt');
  if (lblIt) {
    lblIt.innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';
  }

  // 총 세전 금액 및 공제 차액 표시
  document.getElementById('resMainAmount').innerText = fmt(gross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  // 4대보험 및 세금 항목별 금액 반영
  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  // 총 공제합계액 및 예상 실수령액 반영
  document.getElementById('resDeduction').innerText = fmt(ded.totalDed);
  document.getElementById('resNetAmount').innerText = fmt(net);

  // 결과 카드 상단 타이틀 텍스트 세팅
  const extraRow = document.getElementById('extraRow');

  if (currentMode === 'NET_TO_GROSS') {
    document.getElementById('resMainTitle').innerText = '예상 세전 급여';
    if (extraRow) extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '입력 세전 급여 (과세+비과세)';
    if (extraRow) extraRow.classList.add('hidden');
  }

  // 결과 영역 표시 및 화면 스크롤 포커스
  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
