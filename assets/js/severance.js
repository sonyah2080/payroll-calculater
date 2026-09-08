/**
 * ============================================================================
 * 퇴직금 및 퇴직소득세 산출 메인 컨트롤러 (severance.js)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnCalculate = document.getElementById('btnCalculate');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');

  // 💡 HTML에 4번째 칸이 없으면 JS가 알아서 추가해주는 안전 장치
  ensureFourthRowExists();

  // 입력창 콤마 포맷터 연결 (common.js 함수)
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]:not(.month-input)').forEach(attachFormatter);
    document.querySelectorAll('.month-input').forEach(attachFormatter);
  }

  const regularSalaryInput = document.getElementById('regularSalary');
  // 통상임금 수동입력 방지 (이전 요청사항 반영)
  if (regularSalaryInput) regularSalaryInput.disabled = true; 

  // 💡 [핵심 수정] 3~4개의 칸 중 '가장 금액이 큰 칸(온전한 한 달 치)'을 찾아 통상임금으로 자동 세팅
  function autoUpdateRegularSalary() {
    const rows = document.querySelectorAll('.month-row');
    let maxTotal = 0;

    rows.forEach(row => {
      if (row.style.display !== 'none') {
        const salInput = row.querySelector('.month-input.salary');
        const tfInput = row.querySelector('.month-input.taxfree');
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

  // 모든 급여/비과세 입력칸에 실시간 연동 이벤트 걸기
  const allMonthInputs = document.querySelectorAll('.month-input');
  allMonthInputs.forEach(input => {
    input.addEventListener('input', autoUpdateRegularSalary);
    input.addEventListener('keyup', autoUpdateRegularSalary);
  });

  // ========================================================
  // 💡 입사일/퇴사일 날짜 자동 하이픈 및 3개월 쪼개기 연동
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

// 💡 HTML에 4번째 칸이 없을 경우 동적으로 만들어주는 함수
function ensureFourthRowExists() {
  const grid = document.querySelector('.month-grid');
  if (!grid) return;
  const rows = grid.querySelectorAll('.month-row');
  if (rows.length === 3) {
    const row4 = document.createElement('div');
    row4.className = 'month-row';
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

// 💡 날짜에 맞춰 라벨(글자)만 바꿔주고, 4번째 칸 노출 여부 결정
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
    periods.push(`${currStart.getFullYear()}년 ${currStart.getMonth() + 1}월 <span style="font-size: 10px; color: var(--bluescale-600); font-weight: 600;">(${days}일)</span>`);
    
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

// 공제 계산 함수들
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
  const serviceYears = Math.max(1, Math.floor(workingDays / 365));

  if (workingDays < 365) alert('재직일수가 1년(365일) 미만인 경우 법정 퇴직금 지급 대상이 아닙니다.');

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
        tr.innerHTML = `
          <td class="center" style="font-size: 11px; line-height: 1.3;">${label.innerHTML}</td>
          <td class="num">${fmt(sal)}</td>
          <td class="num">${fmt(tf)}</td>
          <td class="num">${fmt(rowSum)}</td>
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
      <td class="num" style="font-weight:700;">${fmt(totalSalarySum)}</td>
      <td class="num" style="font-weight:700;">${fmt(totalTaxFreeSum)}</td>
      <td class="num" style="font-weight:700; color:#1e3a8a;">${fmt(totalSalarySum + totalTaxFreeSum)}</td>
    `;
    rpt3MonthBody.appendChild(trSubtotal);
  }

  const annualBonus = parseCurrency(document.getElementById('annualBonus')?.value || '0');
  const annualLeave = parseCurrency(document.getElementById('annualLeaveFee')?.value || '0');
  const bonus3Month = Math.floor((annualBonus * (3 / 12)) / 10) * 10;
  const leave3Month = Math.floor((annualLeave * (3 / 12)) / 10) * 10;
  
  const grandTotal3Month = totalSalarySum + totalTaxFreeSum + bonus3Month + leave3Month;
  const days3Months = 92;

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
    const convSalary = Math.floor(Math.max(0, severancePay - svcDeduction) * 12 / serviceYears);
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

  if(document.getElementById('rptBonus312')) document.getElementById('rptBonus312').innerText = fmt(bonus3Month);
  if(document.getElementById('rptLeave312')) document.getElementById('rptLeave312').innerText = fmt(leave3Month);
  if(document.getElementById('rptTotal3M')) document.getElementById('rptTotal3M').innerText = fmt(grandTotal3Month);

  if(document.getElementById('rptAvg1Day')) document.getElementById('rptAvg1Day').innerText = fmt(Math.round(averageWage));
  if(document.getElementById('rptReg1Day')) document.getElementById('rptReg1Day').innerText = fmt(Math.round(reg1DayPay));
  if(document.getElementById('rptApplied1Day')) document.getElementById('rptApplied1Day').innerText = fmt(Math.round(appliedWage));
  if(document.getElementById('rptFinalSeverance')) document.getElementById('rptFinalSeverance').innerText = fmt(finalNetPay);

  const resultBox = document.getElementById('resultBox');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
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