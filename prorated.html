document.addEventListener('DOMContentLoaded', () => {
  // 포맷터 연결
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

// 10원 단위 절사
const floor10 = val => Math.floor(val / 10) * 10;

// 간이 소득세 대략 계산식 (일할용)
function estimateIncomeTax(taxable) {
  if (taxable <= 1060000) return 0;
  if (taxable <= 2000000) return (taxable - 1060000) * 0.06 * 0.5;
  if (taxable <= 3000000) return 28200 + (taxable - 2000000) * 0.15 * 0.6;
  if (taxable <= 4000000) return 118200 + (taxable - 3000000) * 0.15 * 0.8;
  return 238200 + (taxable - 4000000) * 0.24 * 0.8;
}

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

  // 1. 일할 세전 과세급여 및 비과세급여 산출
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

  // 2. 4대보험 및 세금 공제 계산 (체크박스 반영)
  const chkNp = document.getElementById('proChkNp').checked;
  const chkHi = document.getElementById('proChkHi').checked;
  const chkEi = document.getElementById('proChkEi').checked;
  const chkTax = document.getElementById('proChkTax').checked;

  // 4대보험 기준소득월액 상한선 반영
  const npBase = Math.min(Math.max(proratedTaxable, 390000), 6170000);
  
  const np = chkNp ? floor10(npBase * 0.045) : 0;
  const hi = chkHi ? floor10(proratedTaxable * 0.03545) : 0;
  const lt = chkHi ? floor10(hi * 0.1295) : 0;
  const ei = chkEi ? floor10(proratedTaxable * 0.009) : 0;

  const incomeTax = chkTax ? floor10(estimateIncomeTax(proratedTaxable)) : 0;
  const localTax = chkTax ? floor10(incomeTax * 0.1) : 0;

  const totalDeduction = np + hi + lt + ei + incomeTax + localTax;
  const netPay = totalProratedGross - totalDeduction;

  // 3. UI 바인딩 (fmt 함수 활용)
  document.getElementById('resProGross').innerText = fmt(totalProratedGross);
  document.getElementById('resProNp').innerText = fmt(np);
  document.getElementById('resProHi').innerText = fmt(hi);
  document.getElementById('resProLt').innerText = fmt(lt);
  document.getElementById('resProEi').innerText = fmt(ei);
  document.getElementById('resProIt').innerText = fmt(incomeTax);
  document.getElementById('resProLtTax').innerText = fmt(localTax);
  
  document.getElementById('resProTotalDeduction').innerText = fmt(totalDeduction);
  document.getElementById('resProNet').innerText = fmt(netPay);

  // 결과 박스 출력 애니메이션
  const resultBox = document.getElementById('proResultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
