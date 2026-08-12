/**
 * ============================================================================
 * 퇴직금 및 퇴직소득세 산출 메인 컨트롤러 (severance.js)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnCalculate = document.getElementById('btnCalculate');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  
  const salary1 = document.querySelectorAll('.month-input.salary')[0];
  const taxfree1 = document.querySelectorAll('.month-input.taxfree')[0];
  const regularSalaryInput = document.getElementById('regularSalary');

  // 💡 [수정] 성명(workerName) 입력창을 제외하고 '금액' 입력창에만 콤마 포맷터 적용
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('.month-input, #annualBonus, #annualLeaveFee').forEach(attachFormatter);
  }
  // ========================================================
  // 💡 입사일/퇴사일 "20260101" ➔ "2026-01-01" 자동 변환기
  // ========================================================
  const dateInputs = document.querySelectorAll('#startDate, #endDate');
  
  dateInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      // 1. 사용자가 입력한 값에서 숫자만 쏙 골라냄
      let val = e.target.value.replace(/[^0-9]/g, '');
      
      // 2. 8자리(YYYYMMDD)가 넘어가면 뒷부분은 무시
      if (val.length > 8) {
        val = val.substring(0, 8);
      }

      // 3. 글자 수에 맞춰 자동으로 중간에 하이픈(-) 끼워넣기
      if (val.length >= 5 && val.length <= 6) {
        // 5글자 이상 (예: 20260) ➔ 2026-0
        e.target.value = val.substring(0, 4) + '-' + val.substring(4);
      } else if (val.length >= 7) {
        // 7글자 이상 (예: 2026010) ➔ 2026-01-0
        e.target.value = val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6);
      } else {
        // 4글자 이하 (예: 2026) ➔ 그대로 둠
        e.target.value = val;
      }
    });
  });
  // ========================================================


  // 💡 [수정] 통상임금 완전 자동 계산 연동 (Disabled 상태 업데이트)
  function autoUpdateRegularSalary() {
    if (regularSalaryInput && salary1) {
      const sal = parseCurrency(salary1.value);
      const tf = taxfree1 ? parseCurrency(taxfree1.value) : 0;
      const autoTotal = sal + tf;
      
      // toLocaleString()만 사용하여 '원' 글자가 인풋박스 안으로 들어가는 것 방지
      regularSalaryInput.value = autoTotal.toLocaleString();
    }
  }

  // 상단 1개월전 급여/비과세 입력 시 즉각 반응
  if (salary1) {
    salary1.addEventListener('input', autoUpdateRegularSalary);
    salary1.addEventListener('keyup', autoUpdateRegularSalary);
  }
  if (taxfree1) {
    taxfree1.addEventListener('input', autoUpdateRegularSalary);
    taxfree1.addEventListener('keyup', autoUpdateRegularSalary);
  }

  // 산정내역서 생성 버튼 이벤트
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      generateStatement();
    });
  }

  // PDF 다운로드 버튼 이벤트
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', (e) => {
      e.preventDefault();
      downloadPdf();
    });
  }

  // 초기 진입 시 1회 자동 업데이트 수행
  autoUpdateRegularSalary();
});

// 날짜 포맷팅 유틸리티 (2026-01-01 -> 2026. 01. 01.)
function formatDateKor(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
}

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

/**
 * =========================================================================
 * 퇴직금 & 퇴직소득세 산정내역서 생성
 * =========================================================================
 */
function generateStatement() {
  const name = document.getElementById('workerName').value.trim() || '근로자';
  const startDateStr = document.getElementById('startDate').value;
  const endDateStr = document.getElementById('endDate').value;

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate) || isNaN(endDate) || endDate <= startDate) {
    alert('입사일과 퇴사일을 올바르게 선택해 주세요.');
    return;
  }

  // 총 재직일수 및 근속연수
  const diffTime = endDate.getTime() - startDate.getTime();
  const workingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 입사일 당일 포함
  const serviceYears = Math.max(1, Math.floor(workingDays / 365));

  if (workingDays < 365) {
    alert('재직일수가 1년(365일) 미만인 경우 법정 퇴직금 지급 대상이 아닙니다.');
  }

  // 최근 3개월 급여 처리
  const salaries = document.querySelectorAll('.month-input.salary');
  const taxFrees = document.querySelectorAll('.month-input.taxfree');
  const rpt3MonthBody = document.getElementById('rpt3MonthBody');
  if (rpt3MonthBody) rpt3MonthBody.innerHTML = '';

  let totalSalarySum = 0;
  let totalTaxFreeSum = 0;

  for (let i = 0; i < 3; i++) {
    const sal = parseCurrency(salaries[i]?.value || '0');
    const tf = parseCurrency(taxFrees[i]?.value || '0');
    const rowSum = sal + tf;

    totalSalarySum += sal;
    totalTaxFreeSum += tf;

    if (rpt3MonthBody) {
      const tr = document.createElement('tr');
      // 💡 [수정] 템플릿의 '원' 텍스트 삭제 (fmt에서 처리되거나 생략)
      tr.innerHTML = `
        <td class="center">${i + 1}개월전</td>
        <td class="num">${fmt(sal)}</td>
        <td class="num">${fmt(tf)}</td>
        <td class="num">${fmt(rowSum)}</td>
      `;
      rpt3MonthBody.appendChild(tr);
    }
  }

  if (rpt3MonthBody) {
    const trSubtotal = document.createElement('tr');
    trSubtotal.style.backgroundColor = '#f8fafc';
    trSubtotal.innerHTML = `
      <td class="center" style="font-weight:700;">소 계</td>
      <td class="num" style="font-weight:700;">${fmt(totalSalarySum)}</td>
      <td class="num" style="font-weight:700;">${fmt(totalTaxFreeSum)}</td>
      <td class="num" style="font-weight:700; color:#1e3a8a;">${fmt(totalSalarySum + totalTaxFreeSum)}</td>
    `;
    rpt3MonthBody.appendChild(trSubtotal);
  }

  // 상여금 및 연차수당 3/12 반영
  const annualBonus = parseCurrency(document.getElementById('annualBonus').value || '0');
  const annualLeaveFee = parseCurrency(document.getElementById('annualLeaveFee').value || '0');
  const bonus312 = Math.floor((annualBonus * (3 / 12)) / 10) * 10;
  const leave312 = Math.floor((annualLeaveFee * (3 / 12)) / 10) * 10;

  const total3MonthPay = totalSalarySum + totalTaxFreeSum + bonus312 + leave312;
  const daysIn3Months = 92;

  // 1일 평균임금
  const avg1DayPay = total3MonthPay / daysIn3Months;

  // 1일 통상임금 (월 통상임금 ÷ 209 × 8시간)
  let regularSalaryMonthly = parseCurrency(document.getElementById('regularSalary').value || '0');
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

  // 세전 퇴직금 산출 (10원 단위 절사 적용)
  const rawSeverance = final1DayPay * 30 * (workingDays / 365);
  const grossSeverance = Math.floor(rawSeverance / 10) * 10;

  // 퇴직소득세 자동 계산
  const chkCalcTax = document.getElementById('chkCalcTax').checked;
  let incomeTax = 0, localTax = 0, totalTax = 0;
  let netSeverance = grossSeverance;

  if (chkCalcTax) {
    const serviceDeduction = getServiceYearsDeduction(serviceYears);
    const taxBaseBeforeConvert = Math.max(0, grossSeverance - serviceDeduction);
    const convertedSalary = Math.floor((taxBaseBeforeConvert * 12) / serviceYears);
    const convertedDeduction = getConvertedSalaryDeduction(convertedSalary);
    const taxBaseConverted = Math.max(0, convertedSalary - convertedDeduction);

    // taxTable.js에 정의된 getBasicTax() 호출 (없을 시 비상 계산)
    let convertedTax = 0;
    if (typeof getBasicTax === 'function') {
      convertedTax = getBasicTax(taxBaseConverted);
    } else {
      convertedTax = calculateBasicTaxFallback(taxBaseConverted);
    }

    const rawIncomeTax = (convertedTax / 12) * serviceYears;
    incomeTax = Math.floor(rawIncomeTax / 10) * 10;
    localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
    totalTax = incomeTax + localTax;

    netSeverance = grossSeverance - totalTax;

    // 💡 [수정] 템플릿의 '원' 텍스트 모두 삭제
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

  // 💡 리포트 UI 데이터 동기화
  document.getElementById('rptName').innerText = name;
  document.getElementById('rptStartDate').innerText = formatDateKor(startDateStr);
  document.getElementById('rptEndDate').innerText = formatDateKor(endDateStr);
  document.getElementById('rptWorkingDays').innerText = `${workingDays.toLocaleString()} 일 (${serviceYears}년차)`;
  document.getElementById('rptPeriod').innerText = `${formatDateKor(startDateStr)} ~ ${formatDateKor(endDateStr)}`;

  document.getElementById('rptBonus312').innerText = fmt(bonus312);
  document.getElementById('rptLeave312').innerText = fmt(leave312);
  document.getElementById('rptTotal3M').innerText = fmt(total3MonthPay);

  document.getElementById('rptAvg1Day').innerText = fmt(Math.round(avg1DayPay));
  document.getElementById('rptReg1Day').innerText = fmt(Math.round(reg1DayPay));
  document.getElementById('rptApplied1Day').innerText = fmt(Math.round(final1DayPay));

  document.getElementById('rptFinalSeverance').innerText = fmt(netSeverance);

  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// taxTable.js 누락 대비 비상용 기본세율 함수
function calculateBasicTaxFallback(taxBase) {
  if (taxBase <= 14000000) return taxBase * 0.06;
  if (taxBase <= 50000000) return 840000 + (taxBase - 14000000) * 0.15;
  if (taxBase <= 88000000) return 6240000 + (taxBase - 50000000) * 0.24;
  if (taxBase <= 150000000) return 15360000 + (taxBase - 88000000) * 0.35;
  if (taxBase <= 300000000) return 37060000 + (taxBase - 150000000) * 0.38;
  if (taxBase <= 500000000) return 94060000 + (taxBase - 300000000) * 0.40;
  if (taxBase <= 1000000000) return 174060000 + (taxBase - 500000000) * 0.42;
  return 384060000 + (taxBase - 1000000000) * 0.45;
}

/**
 * =========================================================================
 * PDF 다운로드 기능 함수
 * =========================================================================
 */
function downloadPdf() {
  const element = document.getElementById('pdfArea');
  const resultBox = document.getElementById('resultBox');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const name = document.getElementById('workerName').value.trim() || '근로자';

  if (!element) {
    alert('PDF로 변환할 산정내역서 영역을 찾을 수 없습니다.');
    return;
  }

  if (resultBox) {
    resultBox.style.display = 'block';
  }

  if (btnDownloadPdf) btnDownloadPdf.style.display = 'none';
  element.classList.add('pdf-mode');

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

  html2pdf().set(opt).from(element).save()
    .then(() => {
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