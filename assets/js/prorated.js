document.addEventListener('DOMContentLoaded', () => {
  // 1. 공통 포맷터 연동
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  // 2. 날짜 자동 포맷팅 (숫자 8자리 입력 시 YYYY-MM-DD 변환)
  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  [startEl, endEl].forEach(input => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 8) val = val.substring(0, 8);
      if (val.length === 8) {
        e.target.value = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      } else {
        e.target.value = val;
      }
      checkMidMonthEntry();
    });
    input.addEventListener('change', checkMidMonthEntry);
    input.addEventListener('blur', checkMidMonthEntry);
  });

  // 💡 3. 소득세 체크박스 상태에 따라 [비율 선택창 / 부양가족창] 노출 숨김 처리
  const proChkTax = document.getElementById('proChkTax');
  const proTaxRateGroup = document.getElementById('proTaxRateGroup');
  const proDependentsGroup = document.getElementById('proDependentsGroup');

  function toggleTaxOptions() {
    const isChecked = proChkTax ? proChkTax.checked : true;
    if (proTaxRateGroup) proTaxRateGroup.style.display = isChecked ? 'block' : 'none';
    if (proDependentsGroup) proDependentsGroup.style.display = isChecked ? 'block' : 'none';
  }

  if (proChkTax) {
    proChkTax.addEventListener('change', toggleTaxOptions);
    toggleTaxOptions(); // 초기 로딩 시 반영
  }

  // 💡 4. 소득세 비율 '직접 입력' 선택 시 입력창 노출 처리
  const taxRateSelect = document.getElementById('proTaxRateSelect');
  const taxRateCustom = document.getElementById('proTaxRateCustom');

  if (taxRateSelect && taxRateCustom) {
    taxRateSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        taxRateCustom.style.display = 'block';
        taxRateCustom.focus();
      } else {
        taxRateCustom.style.display = 'none';
      }
    });
    taxRateCustom.style.display = (taxRateSelect.value === 'custom') ? 'block' : 'none';
  }

  // 5. 계산 버튼 이벤트 (폼 제출 방지 추가하여 먹통 방지)
  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', (e) => {
      e.preventDefault();
      calculateProrated();
    });
  }

  checkMidMonthEntry();
});

// 중도입사자 체크박스 비활성화 처리
function checkMidMonthEntry() {
  const startStr = document.getElementById('proStartDate')?.value.trim();
  const chkNp = document.getElementById('proChkNp');
  const chkHi = document.getElementById('proChkHi');
  
  if (!chkNp || !chkHi || !startStr) return;

  const parts = startStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    if (!isNaN(day) && day !== 1) {
      chkNp.checked = false;
      chkNp.disabled = true;
      chkHi.checked = false;
      chkHi.disabled = true;
    } else {
      chkNp.disabled = false;
      chkNp.checked = true;
      chkHi.disabled = false;
      chkHi.checked = true;
    }
  }
}

// 에러 방지용 헬퍼 함수
function safeParse(val) {
  if (typeof parseCurrency === 'function') return parseCurrency(val);
  return Number(String(val).replace(/[^0-9]/g, '')) || 0;
}

function safeFloor10(val) {
  if (typeof floor10 === 'function') return floor10(val);
  return Math.floor(val / 10) * 10;
}

function safeFmt(val) {
  if (typeof fmt === 'function') return fmt(val);
  return Number(val).toLocaleString('ko-KR');
}

// 💡 메인 일할 계산 로직
function calculateProrated() {
  const baseSalary = safeParse(document.getElementById('proBaseSalary')?.value);
  const taxFree = safeParse(document.getElementById('proTaxFree')?.value);
  let startStr = document.getElementById('proStartDate')?.value.trim() || '';
  let endStr = document.getElementById('proEndDate')?.value.trim() || '';

  if (startStr.length === 8 && !startStr.includes('-')) {
    startStr = `${startStr.substring(0, 4)}-${startStr.substring(4, 6)}-${startStr.substring(6, 8)}`;
    document.getElementById('proStartDate').value = startStr;
  }
  if (endStr.length === 8 && !endStr.includes('-')) {
    endStr = `${endStr.substring(0, 4)}-${endStr.substring(4, 6)}-${endStr.substring(6, 8)}`;
    document.getElementById('proEndDate').value = endStr;
  }

  if (!baseSalary || !startStr || !endStr) {
    alert('월 기본 급여와 근무 기간을 올바르게 입력해 주세요.');
    return;
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  
  if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) {
    alert('근무 시작일과 종료일을 올바른 날짜 형식으로 입력해 주세요.');
    return;
  }

  // 일할 과세급여 비율 계산
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = startDate.getDate();
  const diffTime = endDate.getTime() - startDate.getTime();
  const workedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const proratedRatio = workedDays / daysInMonth;

  // 일할 금액 산출 (10원 절사)
  const proratedTaxable = safeFloor10(baseSalary * proratedRatio);
  const proratedTaxFree = safeFloor10(taxFree * proratedRatio);
  const totalProratedGross = proratedTaxable + proratedTaxFree;

  // 공제 항목 체크박스 상태 확인
  const chkNp = document.getElementById('proChkNp')?.checked ?? false;
  const chkHi = document.getElementById('proChkHi')?.checked ?? false;
  const chkEi = document.getElementById('proChkEi')?.checked ?? false;
  const chkTax = document.getElementById('proChkTax')?.checked ?? false;

  const isEmployedOnFirstDay = (startDay === 1);
  const noteText = !isEmployedOnFirstDay ? '(월중 입사로 당월 면제)' : '';

  // 4대보험 계산 (RATES_CONFIG 연동)
  const npConfig = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.NP : { RATE: 0.0475, MIN_BASE: 390000, MAX_BASE: 6170000 };
  const hiRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.HI.RATE : 0.03595;
  const ltRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.LT.RATE_OF_HI : 0.1314;
  const eiRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.EI.RATE : 0.009;
  const localTaxRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.LOCAL_TAX.RATE : 0.10;

  const npBase = Math.min(Math.max(baseSalary, npConfig.MIN_BASE), npConfig.MAX_BASE);
  const np = (chkNp && isEmployedOnFirstDay) ? safeFloor10(npBase * npConfig.RATE) : 0;
  const hi = (chkHi && isEmployedOnFirstDay) ? safeFloor10(baseSalary * hiRate) : 0;
  const lt = (chkHi && isEmployedOnFirstDay) ? safeFloor10(hi * ltRate) : 0;
  const ei = chkEi ? safeFloor10(proratedTaxable * eiRate) : 0;

  // 💡 소득세 비율 연산 및 적용 로직
  const dependents = parseInt(document.getElementById('proDependents')?.value || '1', 10);
  let incomeTax = 0;
  let taxRatePercent = 0;

  if (chkTax) {
    // 선택된 비율 가져오기
    const selectVal = document.getElementById('proTaxRateSelect')?.value || '100';
    if (selectVal === 'custom') {
      taxRatePercent = parseFloat(document.getElementById('proTaxRateCustom')?.value) || 100;
    } else {
      taxRatePercent = parseFloat(selectVal) || 100;
    }

    // calculator.js의 함수를 사용하되 파라미터 충돌 없이 기본세액(100%)을 가져옴
    let fullMonthTax = 0;
    if (typeof getIncomeTax === 'function') {
      fullMonthTax = getIncomeTax(baseSalary, dependents);
    } else {
      fullMonthTax = baseSalary * 0.03; // 방어코드
    }
    
    // 가져온 기본세액에 선택된 비율을 곱하고 일할비율 적용
    const adjustedTax = fullMonthTax * (taxRatePercent / 100);
    incomeTax = safeFloor10(adjustedTax * proratedRatio);
  }

  const localTax = chkTax ? safeFloor10(incomeTax * localTaxRate) : 0;
  const totalDeduction = np + hi + lt + ei + incomeTax + localTax;
  const netPay = totalProratedGross - totalDeduction;

  // 결과 화면 출력
  const el = (id) => document.getElementById(id);
  
  if(el('resProGross')) el('resProGross').innerText = safeFmt(totalProratedGross) + ' 원';
  if(el('resProTaxable')) el('resProTaxable').innerText = safeFmt(proratedTaxable) + ' 원';
  if(el('resProTaxFree')) el('resProTaxFree').innerText = safeFmt(proratedTaxFree) + ' 원';

  if(el('resProNp')) el('resProNp').innerText = safeFmt(np) + ' 원';
  if(el('resProHi')) el('resProHi').innerText = safeFmt(hi) + ' 원';
  if(el('resProLt')) el('resProLt').innerText = safeFmt(lt) + ' 원';
  if(el('resProEi')) el('resProEi').innerText = safeFmt(ei) + ' 원';
  if(el('resProIt')) el('resProIt').innerText = safeFmt(incomeTax) + ' 원';
  if(el('resProLtTax')) el('resProLtTax').innerText = safeFmt(localTax) + ' 원';

  if(el('resProTaxRateLabel')) {
    el('resProTaxRateLabel').innerText = chkTax ? `(${taxRatePercent}% 적용)` : '';
  }
  if(el('noteNp')) el('noteNp').innerText = (!chkNp || !isEmployedOnFirstDay) ? noteText : '';
  if(el('noteHi')) el('noteHi').innerText = (!chkHi || !isEmployedOnFirstDay) ? noteText : '';

  if(el('resProTotalDeduction')) el('resProTotalDeduction').innerText = safeFmt(totalDeduction) + ' 원';
  if(el('resProNet')) el('resProNet').innerText = safeFmt(netPay) + ' 원';

  const resultBox = document.getElementById('proResultBox');
  if (resultBox) {
    resultBox.style.display = 'block'; // 숨겨진 창 띄우기
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}