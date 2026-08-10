/**
 * ============================================================================
 * 급여 일할 계산기 연동 로직 (prorated.js)
 * 
 * [주요 기능]
 * 1. 기준년월 선택 시 당월 1일 ~ 당월 말일 자동 세팅
 * 2. 날짜 입력칸 8자리(YYYYMMDD) 연속 입력 시 YYYY-MM-DD 자동 포맷팅
 * 3. 월 과세/비과세 급여의 일할(달력 일수) 산출 (10원 단위 절사)
 * 4. 4대보험(상/하한선 반영) 및 기존 calculator.js 간이세액표 연동을 통한 세액 산출
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 천단위 콤마 및 키패드 +키(000 입력) 포맷터 이벤트 연결
  if (typeof attachFormatter === 'function') {
    document.querySelectorAll('input[type="text"]').forEach(attachFormatter);
  }

  const monthEl = document.getElementById('proTargetMonth');
  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  // 2. 초기 로딩 시 오늘 날짜 기준 당월(YYYY-MM) 자동 선택
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  
  if (monthEl) {
    monthEl.value = `${yyyy}-${mm}`;
    updateMonthDates(`${yyyy}-${mm}`); // 당월 1일 ~ 말일 자동 세팅 호출

    // 기준년월 셀렉트 변경 시 시작일/종료일 자동 업데이트 이벤트
    monthEl.addEventListener('change', (e) => {
      updateMonthDates(e.target.value);
    });
  }

  // 3. 날짜 입력칸 8자리 숫자 연속 타이핑 지원 (YYYYMMDD -> YYYY-MM-DD)
  [startEl, endEl].forEach(input => {
    if (!input) return;

    // 입력 중 8자리가 채워지면 즉시 하이픈(-) 자동 삽입
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, ''); // 숫자 이외 제거
      if (val.length > 8) val = val.substring(0, 8);

      if (val.length === 8) {
        e.target.value = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      } else {
        e.target.value = val;
      }
    });

    // 포커스를 잃었을 때(blur) 형태 보정
    input.addEventListener('blur', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length === 8) {
        e.target.value = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      }
    });
  });

  // 4. 계산하기 버튼 클릭 이벤트 리스너 연결
  const btnCalc = document.getElementById('btnProratedCalc');
  if (btnCalc) {
    btnCalc.addEventListener('click', calculateProrated);
  }
});

/**
 * 선택된 기준년월(YYYY-MM)을 기반으로 당월 1일과 당월 마지막 날짜를 자동 계산하여 입력칸에 세팅
 * @param {string} yearMonthStr - 'YYYY-MM' 형식의 문자열
 */
function updateMonthDates(yearMonthStr) {
  if (!yearMonthStr) return;
  const [y, m] = yearMonthStr.split('-').map(Number);
  
  // 당월 1일 문자열 생성
  const startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
  
  // Date 객체의 day에 0을 전달하여 당월 마지막 날짜(28/29/30/31일) 구하기
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const startEl = document.getElementById('proStartDate');
  const endEl = document.getElementById('proEndDate');

  if (startEl) startEl.value = startDateStr;
  if (endEl) endEl.value = endDateStr;
}

/**
 * 메인 일할 급여 및 4대보험, 소득세 산출 함수
 */
function calculateProrated() {
  // 1. 입력값 가져오기 및 숫자 변환
  const baseSalary = parseCurrency(document.getElementById('proBaseSalary').value);
  const taxFree = parseCurrency(document.getElementById('proTaxFree').value);
  let startStr = document.getElementById('proStartDate').value.trim();
  let endStr = document.getElementById('proEndDate').value.trim();
  const calcType = document.getElementById('proCalcType').value;

  // 하이픈 없는 8자리 숫자 입력 예외 처리 보정
  if (startStr.length === 8 && !startStr.includes('-')) {
    startStr = `${startStr.substring(0, 4)}-${startStr.substring(4, 6)}-${startStr.substring(6, 8)}`;
    document.getElementById('proStartDate').value = startStr;
  }
  if (endStr.length === 8 && !endStr.includes('-')) {
    endStr = `${endStr.substring(0, 4)}-${endStr.substring(4, 6)}-${endStr.substring(6, 8)}`;
    document.getElementById('proEndDate').value = endStr;
  }

  // 필수값 검증
  if (!baseSalary || !startStr || !endStr) {
    alert('월 기본 급여와 근무 기간을 올바르게 입력해 주세요.');
    return;
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  // 날짜 유효성 검증
  if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) {
    alert('근무 시작일과 종료일을 올바른 날짜 형식(YYYYMMDD 또는 YYYY-MM-DD)으로 입력해 주세요.');
    return;
  }

  // 2. 달력 기준 총 일수 및 실제 근무 일수 계산
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 해당 월의 총 일수 (28~31일)

  const diffTime = endDate.getTime() - startDate.getTime();
  const workedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 근무일수 (시작일 포함 +1)

  // 3. 일할 세전 과세 및 비과세 급여 산출 (10원 단위 절사)
  const proratedTaxable = floor10(baseSalary * (workedDays / daysInMonth));
  const proratedTaxFree = floor10(taxFree * (workedDays / daysInMonth));
  const totalProratedGross = proratedTaxable + proratedTaxFree; // 일할 세전 총급여

  // 4. 공제 체크박스 상태 확인
  const chkNp = document.getElementById('proChkNp').checked;
  const chkHi = document.getElementById('proChkHi').checked;
  const chkEi = document.getElementById('proChkEi').checked;
  const chkTax = document.getElementById('proChkTax').checked;

  // 5. 4대보험 공제액 계산
  // 국민연금: 기준소득월액 상한선(6,170,000원) 및 하한선(390,000원) 적용
  const npBase = Math.min(Math.max(proratedTaxable, 390000), 6170000);
  const np = chkNp ? floor10(npBase * 0.045) : 0;                 // 국민연금 4.5%
  const hi = chkHi ? floor10(proratedTaxable * 0.03545) : 0;       // 건강보험 3.545%
  const lt = chkHi ? floor10(hi * 0.1295) : 0;                    // 장기요양 (건강보험료의 12.95%)
  const ei = chkEi ? floor10(proratedTaxable * 0.009) : 0;        // 고용보험 0.9%

  // 6. 소득세 계산 (기존 calculator.js의 getIncomeTax 간이세액표 모듈 연동)
  let incomeTax = 0;
  if (chkTax) {
    if (typeof getIncomeTax === 'function') {
      // 기존 급여계산기 세액 모듈 호출 (부양가족 1인, 원천징수 100% 기준)
      incomeTax = floor10(getIncomeTax(proratedTaxable, 1, 100));
    } else {
      // 예비 3% 기본 적용 로직
      incomeTax = floor10(proratedTaxable * 0.03);
    }
  }
  const localTax = chkTax ? floor10(incomeTax * 0.1) : 0;          // 지방소득세 (소득세의 10%)

  // 7. 총 공제 합계 및 최종 차인지급액(실수령액) 계산
  const totalDeduction = np + hi + lt + ei + incomeTax + localTax;
  const netPay = totalProratedGross - totalDeduction;

  // 8. 화면 UI에 계산 결과 바인딩
  document.getElementById('resProGross').innerText = fmt(totalProratedGross);
  document.getElementById('resProNp').innerText = fmt(np);
  document.getElementById('resProHi').innerText = fmt(hi);
  document.getElementById('resProLt').innerText = fmt(lt);
  document.getElementById('resProEi').innerText = fmt(ei);
  document.getElementById('resProIt').innerText = fmt(incomeTax);
  document.getElementById('resProLtTax').innerText = fmt(localTax);
  
  document.getElementById('resProTotalDeduction').innerText = fmt(totalDeduction);
  document.getElementById('resProNet').innerText = fmt(netPay);

  // 9. 결과 카드 출력 및 스크롤 이동
  const resultBox = document.getElementById('proResultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
