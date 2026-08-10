/**
 * ============================================================================
 * 급여 일할 계산기 연동 로직 (prorated.js)
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
    });
  }

  // 8자리 연속 입력 지원 (YYYYMMDD -> YYYY-MM-DD)
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
    });
  });

  // 소득세 비율 '직접 입력(custom)' 선택 토글 이벤트
  const taxRateSelect = document.getElementById('proTaxRateSelect');
  const taxRateCustom = document.getElementById('proTaxRateCustom');

  if (taxRateSelect && taxRateCustom) {
    taxRateSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        taxRateCustom.style.display = 'block';
      } else {
        taxRateCustom.style.display = 'none';
      }
    });
  }

  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', calculateProrated);
  }
});

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

function calculateProrated() {
  const baseSalary = parseCurrency(document.getElementById('proBaseSalary').value);
  const taxFree = parseCurrency(document.getElementById('proTaxFree').value);
  let startStr = document.getElementById('proStartDate').value.trim();
  let endStr = document.getElementById('proEndDate').value.trim();

  // 8자리 연속 입력 하이픈 자동 처리
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

  // 2. 일할 과세급여 및 비과세급여 분리 산출 (10원 절사)
  const proratedTaxable = floor10(baseSalary * (workedDays / daysInMonth));
  const proratedTaxFree = floor10(taxFree * (workedDays / daysInMonth));
  const totalProratedGross = proratedTaxable + proratedTaxFree;

  // 3. 체크박스 상태 확인
  const chkNp = document.getElementById('proChkNp').checked;
  const chkHi = document.getElementById('proChkHi').checked;
  const chkEi = document.getElementById('proChkEi').checked;
  const chkTax = document.getElementById('proChkTax').checked;

// 4. 입/퇴사자 4대보험 부과 정확한 판별 로직
  // - 입사 조건: 시작일이 1일이어야 당월 보험료 부과 대상
  // - 퇴사 조건: 종료일이 해당 월 말일이어야 당월 보험료 부과 대상
  const isFirstDayEntry = (startDay === 1);           // 1일 입사 여부
  const isLastDayResign = (endDay === daysInMonth);   // 말일 퇴사 여부

  // 국민연금 / 건강보험 부과 여부 결정:
  // 1일 입사이면서 동시에 말일 근무(또는 말일 퇴사)를 만족해야만 당월 보험료가 부과됩니다.
  // 즉, 10일 입사 ~ 31일 근무 처럼 1일 입사가 아닌 중도입사자는 0원(면제) 처리됩니다.
  const isMonthlyInsuranceTarget = isFirstDayEntry && isLastDayResign;

  const noteText = !isMonthlyInsuranceTarget ? '(월중 입/퇴사 면제)' : '';

  // 5. 4대보험 계산
  const npBase = Math.min(Math.max(proratedTaxable, 390000), 6170000);
  
  // 국민연금 & 건강보험: 중도 입사(1일이 아닌 경우) 및 중도 퇴사(말일이 아닌 경우) 0원 적용
  const np = (chkNp && isMonthlyInsuranceTarget) ? floor10(npBase * 0.045) : 0;
  const hi = (chkHi && isMonthlyInsuranceTarget) ? floor10(proratedTaxable * 0.03545) : 0;
  const lt = (chkHi && isMonthlyInsuranceTarget) ? floor10(hi * 0.1295) : 0;
  
  // 고용보험: 입사일/퇴사일과 상관없이 일할 과세급여의 0.9% 정상 공제
  const ei = chkEi ? floor10(proratedTaxable * 0.009) : 0;

  // 6. 소득세 요율 및 부양가족 수 반영 계산
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
      // calculator.js의 정밀 간이세액 산식에 일할 과세급여, 부양가족수, 선택 비율 전달
      incomeTax = floor10(getIncomeTax(proratedTaxable, dependents, taxRatePercent));
    } else {
      incomeTax = floor10(proratedTaxable * 0.03 * (taxRatePercent / 100));
    }
  }
  const localTax = chkTax ? floor10(incomeTax * 0.1) : 0;

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

  // 선택한 소득세 라벨 안내 표시 (예: (80% 적용))
  document.getElementById('resProTaxRateLabel').innerText = chkTax ? `(${taxRatePercent}% 적용)` : '';

  document.getElementById('noteNp').innerText = (chkNp && !isMonthlyInsuranceTarget) ? noteText : '';
  document.getElementById('noteHi').innerText = (chkHi && !isMonthlyInsuranceTarget) ? noteText : '';

  document.getElementById('resProTotalDeduction').innerText = fmt(totalDeduction);
  document.getElementById('resProNet').innerText = fmt(netPay);

  const resultBox = document.getElementById('proResultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
