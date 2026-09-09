/**
 * ============================================================================
 * 퇴직금 및 퇴직소득세 산출 메인 컨트롤러 (severance.js)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnCalculate = document.getElementById('btnCalculate');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');

  // HTML에 4번째 칸이 없으면 생성
  ensureFourthRowExists();

  // 💡 [핵심] 금액 칸(급여, 상여금, 연차, 통상임금)에만 000 포맷터를 적용!
  // 성명(workerName)이나 날짜(startDate, endDate)는 절대 건드리지 않아 꼬임이 없습니다.
  if (typeof attachFormatter === 'function') {
    const moneyInputs = document.querySelectorAll('.month-input, #annualBonus, #annualLeaveFee, #regularSalary');
    moneyInputs.forEach(input => attachFormatter(input));
  }

  const regularSalaryInput = document.getElementById('regularSalary');
  // 통상임금 수동입력 방지
  if (regularSalaryInput) regularSalaryInput.disabled = true; 

  // 3~4개의 칸 중 '가장 금액이 큰 칸(온전한 한 달 치)'을 찾아 통상임금으로 자동 세팅
  function autoUpdateRegularSalary() {
    const rows = document.querySelectorAll('.month-row');
    let maxTotal = 0;

    rows.forEach(row => {
      if (row.style.display !== 'none') {
        const salInput = row.querySelector('.month-input.salary');
        const tfInput = row.querySelector('.month-input.taxfree');
        
        // common.js의 parseCurrency를 안전하게 사용
        const sal = salInput ? parseCurrency(salInput.value) : 0;
        const tf = tfInput ? parseCurrency(tfInput.value) : 0;
        
        if (sal + tf > maxTotal) {
          maxTotal = sal + tf;
        }
      }
    });

    if (regularSalaryInput && maxTotal > 0) {
      regularSalaryInput.value = maxTotal.toLocaleString('ko-KR');
    } else if (regularSalaryInput) {
      regularSalaryInput.value = '';
    }
  }

  // 급여/비과세 입력칸 실시간 연동
  const allMonthInputs = document.querySelectorAll('.month-input');
  allMonthInputs.forEach(input => {
    input.addEventListener('input', autoUpdateRegularSalary);
    input.addEventListener('keyup', autoUpdateRegularSalary);
  });

  // ========================================================
  // 💡 날짜(연도) 입력 시 하이픈(-) 자동 변환 로직
  // ========================================================
  const dateInputs = document.querySelectorAll('#startDate, #endDate');
  dateInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      if (e.inputType === 'deleteContentBackward') return;
      
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 8) val = val.substring(0, 8);
      
      if (val.length >= 5 && val.length <= 6) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4);
      } else if (val.length >= 7) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6);
      } else {
        e.target.value = val;
      }

      if (e.target.id === 'endDate' && e.target.value.length === 10) {
        updateSalaryLabels(e.target.value);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.id === 'endDate' && e.target.value.length === 10) {
        updateSalaryLabels(e.target.value);
      }
    });
  });

  // 초기 로드 시 라벨 세팅 및 통상임금 업데이트
  const endDateInput = document.getElementById('endDate');
  if (endDateInput && endDateInput.value.length === 10) {
    updateSalaryLabels(endDateInput.value);
  }
  autoUpdateRegularSalary();

  // 산정내역서 생성 & PDF 버튼
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      generateStatement();
    });
  }
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof downloadPdf === 'function') downloadPdf();
    });
  }
});

// HTML에 4번째 칸이 없을 경우 동적으로 만들어주는 함수
function ensureFourthRowExists() {
  const grid = document.querySelector('.month-grid');
  if (!grid) return;
  const rows = grid.querySelectorAll('.month-row');
  if (rows.length === 3) {
    const row4 = document.createElement('div');
    row4.className = 'month-row';
    row4.id = 'row4';
    row4.style.display = 'none';
    row4.innerHTML = `
      <span class="month-label">4개월전(일할)</span>
      <div class="input-group">
        <input type="text" class="month-input salary" value="0" inputmode="numeric">
      </div>
      <div class="input-group">
        <input type="text" class="month-input taxfree" value="0" inputmode="numeric">
      </div>
    `;
    grid.appendChild(row4);
  }
}

// 날짜에 맞춰 라벨(글자)만 바꿔주고, 4번째 칸 노출 여부 결정
function updateSalaryLabels(endDateStr) {
  const rows = document.querySelectorAll('.month-row');
  const end = new Date(endDateStr);
  
  if (isNaN(end) || endDateStr.length < 10) {
    if (rows[0]) rows[0].querySelector('.month-label').innerHTML = '1개월전';
    if (rows[1]) rows[1].querySelector('.month-label').innerHTML = '2개월전';
    if (rows[2]) rows[2].querySelector('.month-label').innerHTML = '3개월전';
    if (rows[3]) rows[3].style.display = 'none';
    return;
  }

  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  start.setDate(start.getDate() + 1);

  let periods = [];
  let currStart = new Date(start);

  while (currStart <= end) {
    let currEnd = new Date(currStart.getFullYear(), currStart.getMonth() + 1, 0);
    if (currEnd > end) currEnd = new Date(end);
    
    const days = Math.floor((currEnd - currStart) / (1000 * 60 * 60 * 24)) + 1;
    periods.push(`${currStart.getMonth() + 1}.${currStart.getDate()} ~ ${currEnd.getMonth() + 1}.${currEnd.getDate()} <span style="font-size: 11px; color: var(--bluescale-600); font-weight: 600;">(${days}일)</span>`);
    
    currStart = new Date(currStart.getFullYear(), currStart.getMonth() + 1, 1);
  }

  for (let i = 0; i < 4; i++) {
    if (rows[i]) {
      if (periods[i]) {
        rows[i].querySelector('.month-label').innerHTML = periods[i];
        rows[i].style.display = '';
      } else {
        rows[i].style.display = 'none';
      }
    }
  }
}

// 근속연수 및 환산급여 공제 계산 함수
function getServiceYearsDeduction(years) {
  if (years <= 5) return years * 1000000;
  if (years <= 10) return 5000000 + (years - 5) * 2000000;
  if (years <= 20) return 15000000 + (years - 10) * 2500000;
  return 40000000 + (years - 20) * 3000000;
}
function getConvertedSalaryDeduction(convertedSalary) {
  if (convertedSalary <= 8000000) return convertedSalary;
  if (convertedSalary <= 70000000) return 8000000 + (convertedSalary - 8000000) * 0.6;
  if (convertedSalary <= 100000000) return 45200000 + (convertedSalary - 70000000) * 0.55;
  if (convertedSalary <= 300000000) return 61700000 + (convertedSalary - 100000000) * 0.45;
  return 151700000 + (convertedSalary - 300000000) * 0.35;
}

function formatDateKor(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
}

// 🚨 주의: fmt(), parseCurrency() 함수는 common.js의 것을 그대로 가져다 쓰므로 절대 여기서 다시 선언하지 않습니다!

// 💡 메인 산정 로직
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
  const workingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  const serviceYears = Math.max(1, Math.ceil(workingDays / 365));

  if (workingDays < 365) {
    alert('재직일수가 1년(365일) 미만인 경우 법정 퇴직금 지급 대상이 아닙니다.');
  }

  const rpt3MonthBody = document.getElementById('rpt3MonthBody');
  if (rpt3MonthBody) rpt3MonthBody.innerHTML = '';

  let totalSalarySum = 0;
  let totalTaxFreeSum = 0;

  const rows = document.querySelectorAll('.month-row');
  rows.forEach(row => {
    if (row.style.display !== 'none') {
      const salInput = row.querySelector('.month-input.salary');
      const tfInput = row.querySelector('.month-input.taxfree');
      const label = row.querySelector('.month-label');
      
      const sal = parseCurrency(salInput.value);
      const tf = parseCurrency(tfInput.value);
      const rowSum = sal + tf;
      
      totalSalarySum += sal;
      totalTaxFreeSum += tf;
      
      if (rpt3MonthBody) {
        const tr = document.createElement('tr');
        // 표 안에는 숫자만 깔끔하게 찍기 위해 toLocaleString 사용
        tr.innerHTML = `
          <td class="center" style="font-size: 11px; line-height: 1.3;">${label.innerHTML}</td>
          <td class="num">${Math.round(sal).toLocaleString('ko-KR')}</td>
          <td class="num">${Math.round(tf).toLocaleString('ko-KR')}</td>
          <td class="num">${Math.round(rowSum).toLocaleString('ko-KR')}</td>
        `;
        rpt3MonthBody.appendChild(tr);
      }
    }
  });

  if (rpt3MonthBody) {
    const trSubtotal = document.createElement('tr');
    trSubtotal.style.backgroundColor = '#f8fafc';
    trSubtotal.innerHTML = `
      <td class="center" style="font-weight:700;">소 계</td>
      <td class="num" style="font-weight:700;">${Math.round(totalSalarySum).toLocaleString('ko-KR')}</td>
      <td class="num" style="font-weight:700;">${Math.round(totalTaxFreeSum).toLocaleString('ko-KR')}</td>
      <td class="num" style="font-weight:700; color:#1e3a8a;">${Math.round(totalSalarySum + totalTaxFreeSum).toLocaleString('ko-KR')}</td>
    `;
    rpt3MonthBody.appendChild(trSubtotal);
  }

  const annualBonus = parseCurrency(document.getElementById('annualBonus')?.value || '0');
  const annualLeave = parseCurrency(document.getElementById('annualLeaveFee')?.value || '0');
  
  const bonus3Month = Math.floor(annualBonus * (3 / 12));
  const leave3Month = Math.floor(annualLeave * (3 / 12));
  
  const grandTotal3Month = totalSalarySum + totalTaxFreeSum + bonus3Month + leave3Month;
  
  const d3MonthsAgo = new Date(endDate);
  d3MonthsAgo.setMonth(d3MonthsAgo.getMonth() - 3);
  const days3Months = Math.floor((endDate.getTime() - d3MonthsAgo.getTime()) / (1000 * 60 * 60 * 24)) || 92;

  const averageWage = grandTotal3Month / days3Months; 
  let ordinaryWage = parseCurrency(document.getElementById('regularSalary')?.value || '0'); 
  const reg1DayPay = (ordinaryWage / 209) * 8;

  const wageTypeSelect = document.getElementById('calcMethod')?.value || 'AUTO';
  let appliedWage = averageWage;

  if (wageTypeSelect === 'REG') appliedWage = reg1DayPay;
  else if (wageTypeSelect === 'AVG') appliedWage = averageWage;
  else appliedWage = Math.max(averageWage, reg1DayPay);

  const rawSeverance = appliedWage * 30 * (workingDays / 365);
  const severancePay = Math.floor(rawSeverance / 10) * 10;

  const chkCalcTax = document.getElementById('chkCalcTax')?.checked ?? false;
  let incomeTax = 0, localTax = 0, finalNetPay = severancePay;

  if (chkCalcTax && severancePay > 0) {
    const svcDeduction = getServiceYearsDeduction(serviceYears);
    const taxBaseBeforeConvert = Math.max(0, severancePay - svcDeduction);
    const convSalary = Math.floor(taxBaseBeforeConvert * 12 / serviceYears);
    const convDeduction = getConvertedSalaryDeduction(convSalary);
    const taxBase = Math.max(0, convSalary - convDeduction);
    
    let calcTax = 0;
    if (typeof getBasicTax === 'function') {
      calcTax = getBasicTax(taxBase);
    } else {
      if (taxBase <= 14000000) calcTax = taxBase * 0.06;
      else if (taxBase <= 50000000) calcTax = 840000 + (taxBase - 14000000) * 0.15;
      else if (taxBase <= 88000000) calcTax = 6240000 + (taxBase - 50000000) * 0.24;
      else if (taxBase <= 150000000) calcTax = 15360000 + (taxBase - 88000000) * 0.35;
      else if (taxBase <= 300000000) calcTax = 37060000 + (taxBase - 150000000) * 0.38;
      else if (taxBase <= 500000000) calcTax = 94060000 + (taxBase - 300000000) * 0.40;
      else if (taxBase <= 1000000000) calcTax = 174060000 + (taxBase - 500000000) * 0.42;
      else calcTax = 384060000 + (taxBase - 1000000000) * 0.45;
    }
    
    incomeTax = Math.floor((calcTax / 12 * serviceYears) / 10) * 10;
    localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
    finalNetPay = severancePay - incomeTax - localTax;

    // fmt()가 이미 ' 원'을 붙여주므로 중복해서 적지 않습니다.
    document.getElementById('rptTaxGross').innerText = fmt(severancePay);
    document.getElementById('rptServiceDeduction').innerText = fmt(svcDeduction);
    document.getElementById('rptConvertedSalary').innerText = fmt(convSalary);
    document.getElementById('rptConvertedDeduction').innerText = fmt(convDeduction);
    document.getElementById('rptIncomeTax').innerText = fmt(incomeTax);
    document.getElementById('rptLocalTax').innerText = fmt(localTax);
    document.getElementById('rptTotalTax').innerText = fmt(incomeTax + localTax);

    if (document.getElementById('taxSection')) document.getElementById('taxSection').style.display = 'block';
    if (document.getElementById('resTitleText')) document.getElementById('resTitleText').innerText = '최종 차감지급액 (실수령액)';
  } else {
    if (document.getElementById('taxSection')) document.getElementById('taxSection').style.display = 'none';
    if (document.getElementById('resTitleText')) document.getElementById('resTitleText').innerText = '최종 법정 퇴직금 (세전)';
  }

  if(document.getElementById('rptName')) document.getElementById('rptName').innerText = name;
  if(document.getElementById('rptStartDate')) document.getElementById('rptStartDate').innerText = formatDateKor(startDateStr);
  if(document.getElementById('rptEndDate')) document.getElementById('rptEndDate').innerText = formatDateKor(endDateStr);
  if(document.getElementById('rptWorkingDays')) document.getElementById('rptWorkingDays').innerText = `${workingDays.toLocaleString()} 일 (${serviceYears}년차)`;
  if(document.getElementById('rptPeriod')) document.getElementById('rptPeriod').innerText = `${formatDateKor(startDateStr)} ~ ${formatDateKor(endDateStr)}`;

  document.getElementById('rptBonus312').innerText = fmt(bonus3Month);
  document.getElementById('rptLeave312').innerText = fmt(leave3Month);
  document.getElementById('rptTotal3M').innerText = fmt(grandTotal3Month);

  document.getElementById('rptAvg1Day').innerText = fmt(Math.round(averageWage));
  document.getElementById('rptReg1Day').innerText = fmt(Math.round(reg1DayPay));
  document.getElementById('rptApplied1Day').innerText = fmt(Math.round(appliedWage));
  document.getElementById('rptFinalSeverance').innerText = fmt(finalNetPay);

  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * =========================================================================
 * PDF 다운로드 (window.print 방식 - 텍스트 원본 인쇄)
 * =========================================================================
 */
function downloadPdf() {
  const element = document.getElementById('pdfArea');
  const resultBox = document.getElementById('resultBox');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');

  if (!element) {
    alert('PDF로 변환할 산정내역서 영역을 찾을 수 없습니다.');
    return;
  }

  if (resultBox) resultBox.style.display = 'block';

  element.classList.add('pdf-mode');
  if (btnDownloadPdf) btnDownloadPdf.style.display = 'none';

  const originalTitle = document.title;
  const name = document.getElementById('workerName').value.trim() || '근로자';
  document.title = `퇴직금_산정내역서_${name}`;

  window.print();

  document.title = originalTitle;
  element.classList.remove('pdf-mode');
  if (btnDownloadPdf) btnDownloadPdf.style.display = 'block';
}