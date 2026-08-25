document.addEventListener('DOMContentLoaded', () => {
  const btnCalculate = document.getElementById('btnCalculate');
  const taxAmountInput = document.getElementById('taxAmount');
  const penaltyTypeSelect = document.getElementById('penaltyType');
  const reductionRateSelect = document.getElementById('reductionRate');
  const dueDateInput = document.getElementById('dueDate');
  const payDateInput = document.getElementById('payDate');

  // 1. 공통 포맷터 연결 (콤마 및 +키 000 입력 지원)
  if (typeof attachFormatter === 'function' && taxAmountInput) {
    attachFormatter(taxAmountInput);
  } else if (taxAmountInput) {
    taxAmountInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val ? Number(val).toLocaleString('ko-KR') : '';
    });
  }

  // 2. 날짜 입력창 8자리 연속 입력 시 자동 하이픈(-) 변환기
  const dateInputs = document.querySelectorAll('#dueDate, #payDate');
  dateInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 8) val = val.substring(0, 8); 

      if (val.length >= 5 && val.length <= 6) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4); 
      } else if (val.length >= 7) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6); 
      } else {
        e.target.value = val; 
      }
    });
  });

  // 3. 10원 단위 절사 유틸리티 함수
  function floor10(value) {
    return Math.floor(value / 10) * 10;
  }

  // 4. 메인 가산세 계산 및 화면 출력 함수
  function calculatePenalty() {
    // 기본 세액 추출
    const baseTax = parseInt(taxAmountInput.value.replace(/,/g, ''), 10) || 0;
    const penaltyRate = parseFloat(penaltyTypeSelect.value) || 0;
    const reductionRate = parseFloat(reductionRateSelect.value) || 0;

    // 신고불성실 가산세 산출 (감면율 반영)
    let reportPenalty = baseTax * penaltyRate;
    reportPenalty = reportPenalty * (1 - reductionRate);
    reportPenalty = floor10(reportPenalty);

    // 날짜 추출 및 지연 일수 계산
    let delayDays = 0;
    const dueVal = dueDateInput.value.replace(/[^0-9]/g, '');
    const payVal = payDateInput.value.replace(/[^0-9]/g, '');

    if (dueVal.length === 8 && payVal.length === 8) {
      const dueDate = new Date(`${dueVal.substring(0,4)}-${dueVal.substring(4,6)}-${dueVal.substring(6,8)}`);
      const payDate = new Date(`${payVal.substring(0,4)}-${payVal.substring(4,6)}-${payVal.substring(6,8)}`);

      if (!isNaN(dueDate) && !isNaN(payDate)) {
        const diffTime = payDate.getTime() - dueDate.getTime();
        delayDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (delayDays < 0) delayDays = 0; // 납부기한 이전 납부 시 지연일수 0일
      }
    }

    // 납부지연 가산세 산출 (1일당 22/100,000)
    const delayRatePerDay = 22 / 100000;
    let delayPenalty = baseTax * delayDays * delayRatePerDay;
    delayPenalty = floor10(delayPenalty);

    // 총 합계
    const totalPenalty = reportPenalty + delayPenalty;
    const totalAmount = baseTax + totalPenalty;

    // 💡 화면(UI) 출력 및 결과창 노출 로직 (이곳에 있어야 에러가 안 납니다!)
    const fmt = (num) => num.toLocaleString('ko-KR');
    document.getElementById('resBaseTax').innerText = fmt(baseTax) + ' 원';
    document.getElementById('resReportPenalty').innerText = fmt(reportPenalty) + ' 원';
    document.getElementById('resDelayDays').innerText = fmt(delayDays) + ' 일';
    document.getElementById('resDelayPenalty').innerText = fmt(delayPenalty) + ' 원';
    document.getElementById('resTotalPenalty').innerText = fmt(totalPenalty) + ' 원';
    document.getElementById('resTotalAmount').innerText = fmt(totalAmount) + ' 원';

    const resultBox = document.getElementById('resultBox');
    if (resultBox) {
      resultBox.classList.add('show');
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 5. 버튼 클릭 이벤트
  if (btnCalculate) {
    btnCalculate.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 유효성 검사
      if (!dueDateInput.value || !payDateInput.value) {
        alert('법정납부기한과 실제납부(예정)일을 모두 입력해 주세요.');
        return;
      }
      
      // 계산 실행
      calculatePenalty();
    });
  }
});