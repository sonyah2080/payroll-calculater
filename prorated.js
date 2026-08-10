document.addEventListener('DOMContentLoaded', () => {
  // 콤마 및 키패드 + 키 지원 연결
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', calculateProrated);
  }
});

function calculateProrated() {
  const salary = parseCurrency(document.getElementById('proBaseSalary').value);
  const startStr = document.getElementById('proStartDate').value;
  const endStr = document.getElementById('proEndDate').value;
  const calcType = document.getElementById('proCalcType').value;

  if (!salary || !startStr || !endStr) {
    alert('월 급여와 근무 시작일, 종료일을 모두 입력해 주세요.');
    return;
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (endDate < startDate) {
    alert('종료일은 시작일보다 이후 날짜여야 합니다.');
    return;
  }

  // 시작일이 속한 월의 총 일수 (28~31일)
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 재직/근무 일수 (시작일 포함)
  const diffTime = endDate.getTime() - startDate.getTime();
  const workedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  let proratedSalary = 0;

  if (calcType === 'TOTAL_DAYS') {
    // 월 달력 일수 기준 일할 계산 (원 단위 절사)
    proratedSalary = Math.floor((salary * (workedDays / daysInMonth)) / 10) * 10;
  } else {
    // 통상 209시간/고정 기준 필요시 확장 가능
    proratedSalary = Math.floor((salary * (workedDays / daysInMonth)) / 10) * 10;
  }

  document.getElementById('proResultAmount').innerText = fmt(proratedSalary);
  document.getElementById('proResultBox').style.display = 'block';
}
