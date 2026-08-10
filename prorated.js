document.addEventListener('DOMContentLoaded', () => {
  // 포맷터(천단위 콤마, 키패드 +키 000 입력) 연결
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  // 오늘 날짜 기준으로 이번 달 시작일/종료일 기본 세팅
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 2).toISOString().substring(0, 10);
  const lastDay = new Date(year, month + 1, 1).toISOString().substring(0, 10);

  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  if (startEl && !startEl.value) startEl.value = firstDay;
  if (endEl && !endEl.value) endEl.value = lastDay;

  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', calculateProrated);
  }
});

function calculateProrated() {
  const baseSalary = parseCurrency(document.getElementById('proBaseSalary').value);
  const taxFree = parseCurrency(document.getElementById('proTaxFree').value);
  const startStr = document.getElementById('proStartDate').value;
  const endStr = document.getElementById('proEndDate').value;
  const calcType = document.getElementById('proCalcType').value;

  if (!baseSalary || !startStr || !endStr) {
    alert('월 기본 급여와 근무 기간을 올바르게 입력해 주세요.');
    return;
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (endDate < startDate) {
    alert('종료일은 시작일보다 이후 날짜여야 합니다.');
    return;
  }

  // 달력 일수 및 근무 일수 계산
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const diffTime = endDate.getTime() - startDate.getTime();
  const workedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // 1. 일할 세전 과세급여 및 비과세급여 산출 (10원 절사)
  let proratedTaxable = 0;
  let proratedTaxFree = 0;

  if (calcType === 'TOTAL_DAYS') {
    proratedTaxable = floor10(baseSalary * (workedDays / daysInMonth));
    proratedTaxFree = floor10(taxFree * (workedDays / daysInMonth));
  } else {
    proratedTaxable = floor10(baseSalary * (workedDays / daysInMonth));
    proratedTaxFree = floor10(taxFree * (workedDays / daysInMonth));
  }

  const totalProratedGross = proratedTaxable + proratedTaxFree;

  // 2. 공제 항목 체크 여부 확인
  const chkNp = document.getElementById('proChkNp').checked;
  const chkHi = document.getElementById('proChkHi').checked;
  const chkEi = document.getElementById('proChkEi').checked;
  const chkTax = document.getElementById('proChkTax').checked;

  // 3. 4대보험 계산 (기존 산식 규격 준수)
  // 국민연금 (상한 6,170,000원 / 하한 390,000원 적용)
  const npBase = Math.min(Math.max(proratedTaxable, 390000), 6170000);
  const np = chkNp ? floor10(npBase * 0.045) : 0;
  const hi = chkHi ? floor10(proratedTaxable * 0.03545) : 0;
  const lt = chkHi ? floor10(hi * 0.1295) : 0;
  const ei = chkEi ? floor10(proratedTaxable * 0.009) : 0;

  // 4. 소득세 계산 - 기존 calculator.js의 정밀 간이세액표 로직(getIncomeTax) 모듈 호출
  let incomeTax = 0;
  if (chkTax) {
    if (typeof getIncomeTax === 'function') {
      // 기존 calculator.js 함수 사용 (부양가족 1인, 원천징수 100% 기준)
      incomeTax = floor10(getIncomeTax(proratedTaxable, 1, 100));
    } else {
      // 만약 calculator.js가로드되지 않은 경우 예비 로직
      incomeTax = floor10(proratedTaxable * 0.03); 
    }
  }
  const localTax = chkTax ? floor10(incomeTax * 0.1) : 0;

  // 5. 총 공제액 및 실수령액 산출
  const totalDeduction = np + hi + lt + ei + incomeTax + localTax;
  const netPay = totalProratedGross - totalDeduction;

  // 6. 결과 출력
  document.getElementById('resProGross').innerText = fmt(totalProratedGross);
  document.getElementById('resProNp').innerText = fmt(np);
  document.getElementById('resProHi').innerText = fmt(hi);
  document.getElementById('resProLt').innerText = fmt(lt);
  document.getElementById('resProEi').innerText = fmt(ei);
  document.getElementById('resProIt').innerText = fmt(incomeTax);
  document.getElementById('resProLtTax').innerText = fmt(localTax);
  
  document.getElementById('resProTotalDeduction').innerText = fmt(totalDeduction);
  document.getElementById('resProNet').innerText = fmt(netPay);

  // 결과 영역 펼치기
  const resultBox = document.getElementById('proResultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
