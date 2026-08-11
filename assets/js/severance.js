document.addEventListener('DOMContentLoaded', () => {
  const btnCalculate = document.getElementById('btnCalculate');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');

  // 입력창 콤마 및 키패드 + 키(000) 지원 포맷터 연결
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  // 산정내역서 생성 버튼
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      generateStatement();
    });
  }

  // PDF 다운로드 버튼
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', (e) => {
      e.preventDefault();
      downloadPdf();
    });
  }
});

// 근속연수 공제 계산
function getServiceYearsDeduction(years) {
  if (years <= 5) return years * 1000000;
  if (years <= 10) return 5000000 + (years - 5) * 2000000;
  if (years <= 20) return 15000000 + (years - 10) * 2500000;
  return 40000000 + (years - 20) * 3000000;
}

// 환산급여 공제 계산
function getConvertedSalaryDeduction(convertedSalary) {
  if (convertedSalary <= 8000000) return convertedSalary;
  if (convertedSalary <= 70000000) return 8000000 + (convertedSalary - 8000000) * 0.6;
  if (convertedSalary <= 100000000) return 45200000 + (convertedSalary - 70000000) * 0.55;
  if (convertedSalary <= 300000000) return 61700000 + (convertedSalary - 100000000) * 0.45;
  return 151700000 + (convertedSalary - 300000000) * 0.35;
}

// 퇴직금 & 퇴직소득세 산정내역서 생성
function generateStatement() {
  const name = document.getElementById('workerName').value || '근로자';
  const startDateStr = document.getElementById('startDate').value;
  const endDateStr = document.getElementById('endDate').value;

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate) || isNaN(endDate) || endDate <= startDate) {
    alert('입사일과 퇴사일을 올바르게 선택해 주세요.');
    return;
  }

  const diffTime = endDate.getTime() - startDate.getTime();
  const workingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const serviceYears = Math.max(1, Math.ceil(workingDays / 365));

  if (workingDays < 365) {
    alert('재직일수가 1년(365일) 미만인 경우 법정 퇴직금 지급 대상이 아닙니다.');
  }

  // 최근 3개월 급여 처리
  const salaries = document.querySelectorAll('.month-input.salary');
  const taxFrees = document.querySelectorAll('.month-input.taxfree');
  const rpt3MonthBody = document.getElementById('rpt3MonthBody');
  rpt3MonthBody.innerHTML = '';

  let totalSalarySum = 0;
  let totalTaxFreeSum = 0;

  for (let i = 0; i < 3; i++) {
    const sal = parseCurrency(salaries[i].value);
    const tf = parseCurrency(taxFrees[i].value);
    const rowSum = sal + tf;

    totalSalarySum += sal;
    totalTaxFreeSum += tf;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="center">${i + 1}개월전</td>
      <td class="num">${fmt(sal)}</td>
      <td class="num">${fmt(tf)}</td>
      <td class="num">${fmt(rowSum)}</td>
    `;
    rpt3MonthBody.appendChild(tr);
  }

  const trSubtotal = document.createElement('tr');
  trSubtotal.style.backgroundColor = '#f8fafc';
  trSubtotal.innerHTML = `
    <td class="center" style="font-weight:700;">소 계</td>
    <td class="num" style="font-weight:700;">${fmt(totalSalarySum)}</td>
    <td class="num" style="font-weight:700;">${fmt(totalTaxFreeSum)}</td>
    <td class="num" style="font-weight:700; color:#1e3a8a;">${fmt(totalSalarySum + totalTaxFreeSum)}</td>
  `;
  rpt3MonthBody.appendChild(trSubtotal);

  // 상여금 및 연차수당 3/12 반영
  const annualBonus = parseCurrency(document.getElementById('annualBonus').value);
  const annualLeaveFee = parseCurrency(document.getElementById('annualLeaveFee').value);
  const bonus312 = annualBonus * (3 / 12);
  const leave312 = annualLeaveFee * (3 / 12);

  const total3MonthPay = totalSalarySum + totalTaxFreeSum + bonus312 + leave312;
  const daysIn3Months = 92;

  // 1일 평균임금
  const avg1DayPay = total3MonthPay / daysIn3Months;

  // 1일 통상임금
  let regularSalaryMonthly = parseCurrency(document.getElementById('regularSalary').value);
  if (regularSalaryMonthly === 0) {
    regularSalaryMonthly = parseCurrency(salaries[0].value) + parseCurrency(taxFrees[0].value);
  }
  const reg1DayPay = (regularSalaryMonthly / 209) * 8;

  // 계산 기준 선택 (평균임금 vs 통상임금)
  const calcMethod = document.getElementById('calcMethod').value;
  let final1DayPay = 0;

  if (calcMethod === 'AVG') final1DayPay = avg1DayPay;
  else if (calcMethod === 'REG') final1DayPay = reg1DayPay;
  else final1DayPay = Math.max(avg1DayPay, reg1DayPay);

  // 세전 퇴직금 산출
  const grossSeverance = final1DayPay * 30 * (workingDays / 365);

  // 퇴직소득세 자동 계산
  const chkCalcTax = document.getElementById('chkCalcTax').checked;
  let incomeTax = 0, localTax = 0, totalTax = 0;
  let netSeverance = grossSeverance;

  if (chkCalcTax) {
    const serviceDeduction = getServiceYearsDeduction(serviceYears);
    const taxBaseBeforeConvert = Math.max(0, grossSeverance - serviceDeduction);
    const convertedSalary = (taxBaseBeforeConvert * 12) / serviceYears;
    const convertedDeduction = getConvertedSalaryDeduction(convertedSalary);
    const taxBaseConverted = Math.max(0, convertedSalary - convertedDeduction);

    // 🔥 taxTable.js 에 있는 getBasicTax() 함수를 불러와서 적용합니다.
    const convertedTax = getBasicTax(taxBaseConverted);

    incomeTax = Math.floor((convertedTax * serviceYears) / 12 / 10) * 10;
    localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
    totalTax = incomeTax + localTax;

    netSeverance = grossSeverance - totalTax;

    document.getElementById('rptTaxGross').innerText = fmt(grossSeverance);
    document.getElementById('rptServiceDeduction').innerText = fmt(serviceDeduction);
    document.getElementById('rptConvertedSalary').innerText = fmt(convertedSalary);
    document.getElementById('rptConvertedDeduction').innerText = fmt(convertedDeduction);
    document.getElementById('rptIncomeTax').innerText = fmt(incomeTax);
    document.getElementById('rptLocalTax').innerText = fmt(localTax);
    document.getElementById('rptTotalTax').innerText = fmt(totalTax);

    document.getElementById('taxSection').style.display = 'block';
    document.getElementById('resTitleText').innerText = '최종 차감지급액 (실수령액)';
  } else {
    document.getElementById('taxSection').style.display = 'none';
    document.getElementById('resTitleText').innerText = '최종 법정 퇴직금 (세전)';
  }

  // 리포트 UI 데이터 동기화
  document.getElementById('rptName').innerText = name;
  document.getElementById('rptStartDate').innerText = startDateStr;
  document.getElementById('rptEndDate').innerText = endDateStr;
  document.getElementById('rptWorkingDays').innerText = `${workingDays.toLocaleString()} 일 (${serviceYears}년차)`;
  document.getElementById('rptPeriod').innerText = `${startDateStr} ~ ${endDateStr}`;

  document.getElementById('rptBonus312').innerText = fmt(bonus312);
  document.getElementById('rptLeave312').innerText = fmt(leave312);
  document.getElementById('rptTotal3M').innerText = fmt(total3MonthPay);

  document.getElementById('rptAvg1Day').innerText = fmt(avg1DayPay);
  document.getElementById('rptReg1Day').innerText = fmt(reg1DayPay);
  document.getElementById('rptApplied1Day').innerText = fmt(final1DayPay);

  document.getElementById('rptFinalSeverance').innerText = fmt(netSeverance);

  const resultBox = document.getElementById('resultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// PDF 다운로드 기능 함수 (화면 형태와 PDF 출력 형태 분리)
function downloadPdf() {
  const element = document.getElementById('pdfArea');
  const resultBox = document.getElementById('resultBox');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const name = document.getElementById('workerName').value || '근로자';

  if (!element) {
    alert('PDF로 변환할 산정내역서 영역을 찾을 수 없습니다.');
    return;
  }

  if (resultBox) {
    resultBox.style.display = 'block';
  }

  // 1. PDF 캡처 전: 다운로드 버튼 숨기기 & PDF 전용 스타일 클래스(.pdf-mode) 추가
  if (btnDownloadPdf) btnDownloadPdf.style.display = 'none';
  element.classList.add('pdf-mode');

  // 2. html2pdf 변환 옵션
  const opt = {
    margin: [8, 8, 8, 8],
    filename: `퇴직금_산정내역서_${name}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      scrollX: 0,
      windowWidth: document.documentElement.offsetWidth
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // 3. PDF 생성 수행 후 원상복구
  html2pdf().set(opt).from(element).save()
    .then(() => {
      // 변환 완료 후: 버튼 복원 & PDF 전용 스타일 클래스 제거
      if (btnDownloadPdf) btnDownloadPdf.style.display = 'block';
      element.classList.remove('pdf-mode');
    })
    .catch(err => {
      console.error('PDF 다운로드 에러:', err);
      if (btnDownloadPdf) btnDownloadPdf.style.display = 'block';
      element.classList.remove('pdf-mode');
      alert('PDF 다운로드 처리 중 오류가 발생했습니다.');
    });
}