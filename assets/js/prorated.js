/**
 * ============================================================================
 * 급여 일할 계산기 연동 로직 (prorated.js)
 * - calculator.js의 RATES_CONFIG 및 getIncomeTax 모듈 연동
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  const monthEl = document.getElementById('proTargetMonth');
  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  if (monthEl) {
    monthEl.value = `${yyyy}-${mm}`;
    updateMonthDates(`${yyyy}-${mm}`);

    monthEl.addEventListener('change', (e) => {
      updateMonthDates(e.target.value);
      checkMidMonthEntry();
    });
  }

  // 8자리 연달아 쓰기 (YYYYMMDD -> YYYY-MM-DD)
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

  // 소득세 비율 '직접 입력(custom)' 토글
  const taxRateSelect = document.getElementById('proTaxRateSelect');
  const taxRateCustom = document.getElementById('proTaxRateCustom');

  if (taxRateSelect && taxRateCustom) {
    taxRateSelect.addEventListener('change', (e) => {
      taxRateCustom.style.display = (e.target.value === 'custom') ? 'block' : 'none';
    });
  }

  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', calculateProrated);
  }

  checkMidMonthEntry();
});

// 기준년월 변경 시 시작일/종료일 자동 세팅
function updateMonthDates(yearMonthStr) {
  if (!yearMonthStr) return;
  const [y, m] = yearMonthStr.split('-').map(Number);

  const startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  if (startEl) startEl.value = startDateStr;
  if (endEl) endEl.value = endDateStr;
}

// 1일 입사가 아닌 중도입사자 체크박스 disabled 비활성화 처리
function checkMidMonthEntry() {
  const startStr = document.getElementById('proStartDate').value.trim();
  const chkNp = document.getElementById('proChkNp');
  const chkHi = document.getElementById('proChkHi');

  if (!chkNp || !chkHi || !startStr) return;

  const day = parseInt(startStr.split('-')[2], 10);

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

function calculateProrated() {
  const baseSalary = parseCurrency(document.getElementById('proBaseSalary').value);
  const taxFree = parseCurrency(document.getElementById('proTaxFree').value);
  let startStr = document.getElementById('proStartDate').value.trim();
  let endStr = document.getElementById('proEndDate').value.trim();

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

  // 1. 달력 기준 총 일수 및 근무 일수 계산
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  const diffTime = endDate.getTime() - startDate.getTime();
  const workedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const proratedRatio = workedDays / daysInMonth;

  // 2. 일할 과세급여 및 비과세급여 산출 (10원 절사)
  const proratedTaxable = floor10(baseSalary * proratedRatio);
  const proratedTaxFree = floor10(taxFree * proratedRatio);
  const totalProratedGross = proratedTaxable + proratedTaxFree;

  // 3. 체크박스 상태 확인
  const chkNp = document.getElementById('proChkNp').checked;
  const chkHi = document.getElementById('proChkHi').checked;
  const chkEi = document.getElementById('proChkEi').checked;
  const chkTax = document.getElementById('proChkTax').checked;

  // 4. 입/퇴사자 4대보험 부과 판단 (1일 재직 여부)
  const isEmployedOnFirstDay = (startDay === 1);
  const noteText = !isEmployedOnFirstDay ? '(월중 입사로 당월 면제)' : '(1일 재직자 전액 부과)';

  // 5. RATES_CONFIG 참조하여 4대보험 산출
  const npConfig = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.NP : { RATE: 0.0475, MIN_BASE: 390000, MAX_BASE: 6170000 };
  const hiRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.HI.RATE : 0.03595;
  const ltRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.LT.RATE_OF_HI : 0.1314;
  const eiRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.EI.RATE : 0.009;
  const localTaxRate = (typeof RATES_CONFIG !== 'undefined') ? RATES_CONFIG.LOCAL_TAX.RATE : 0.10;

  // 국민연금/건강보험: 원래 월급 100% 기준
  const npBase = Math.min(Math.max(baseSalary, npConfig.MIN_BASE), npConfig.MAX_BASE);
  const np = (chkNp && isEmployedOnFirstDay) ? floor10(npBase * npConfig.RATE) : 0;
  const hi = (chkHi && isEmployedOnFirstDay) ? floor10(baseSalary * hiRate) : 0;
  const lt = (chkHi && isEmployedOnFirstDay) ? floor10(hi * ltRate) : 0;

  // 고용보험: 일할 계산된 급여 기준
  const ei = chkEi ? floor10(proratedTaxable * eiRate) : 0;

  // 6. 소득세 및 지방소득세 산출
  const dependents = parseInt(document.getElementById('proDependents').value, 10) || 1;
  const selectVal = document.getElementById('proTaxRateSelect').value;
  let taxRatePercent = 100;

  if (selectVal === 'custom') {
    taxRatePercent = parseFloat(document.getElementById('proTaxRateCustom').value) || 100;
  } else {
    taxRatePercent = parseFloat(selectVal);
  }

  let incomeTax = 0;
  if (chkTax) {
    if (typeof getIncomeTax === 'function') {
      const fullMonthTax = getIncomeTax(baseSalary, dependents, taxRatePercent);
      incomeTax = floor10(fullMonthTax * proratedRatio);
    } else {
      incomeTax = floor10(proratedTaxable * 0.03 * (taxRatePercent / 100));
    }
  }

  const localTax = chkTax ? floor10(incomeTax * localTaxRate) : 0;

  const totalDeduction = np + hi + lt + ei + incomeTax + localTax;
  const netPay = totalProratedGross - totalDeduction;

  // 7. 결과 화면 출력
  document.getElementById('resProGross').innerText = fmt(totalProratedGross);
  document.getElementById('resProTaxable').innerText = fmt(proratedTaxable);
  document.getElementById('resProTaxFree').innerText = fmt(proratedTaxFree);

  document.getElementById('resProNp').innerText = fmt(np);
  document.getElementById('resProHi').innerText = fmt(hi);
  document.getElementById('resProLt').innerText = fmt(lt);
  document.getElementById('resProEi').innerText = fmt(ei);
  document.getElementById('resProIt').innerText = fmt(incomeTax);
  document.getElementById('resProLtTax').innerText = fmt(localTax);

  document.getElementById('resProTaxRateLabel').innerText = chkTax ? `(${taxRatePercent}% 적용)` : '';

  // 🔥 에러가 났던 텍스트 출력 부분 변수명 수정 완료
  document.getElementById('noteNp').innerText = (!chkNp || !isEmployedOnFirstDay) ? noteText : '';
  document.getElementById('noteHi').innerText = (!chkHi || !isEmployedOnFirstDay) ? noteText : '';

  document.getElementById('resProTotalDeduction').innerText = fmt(totalDeduction);
  document.getElementById('resProNet').innerText = fmt(netPay);

  const resultBox = document.getElementById('proResultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}