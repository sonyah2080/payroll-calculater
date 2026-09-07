/**
 * ============================================================================
 * 사업소득(3.3%) 실시간 자동 계산 모듈 (business.js)
 * ============================================================================
 */

let currentMode = 'GROSS_TO_NET';

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const amountLabel = document.getElementById('amountLabel');
  const amountInput = document.getElementById('amount');
  const btnClearAmount = document.getElementById('btnClearAmount');

  // 1. 공통 콤마 포맷터
  if (typeof attachFormatter === 'function' && amountInput) {
    attachFormatter(amountInput);
  } else if (amountInput) {
    amountInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = value ? parseInt(value, 10).toLocaleString('ko-KR') : '';
    });
  }

  // 2. 실시간 입력 반응 (버튼 불필요)
  if (amountInput) {
    amountInput.addEventListener('input', calculateBusiness);
    amountInput.addEventListener('keyup', calculateBusiness);
  }

  // 3. 금액 지우기 ✕ 버튼
  if (btnClearAmount && amountInput) {
    btnClearAmount.addEventListener('click', () => {
      amountInput.value = '';
      amountInput.focus();
      calculateBusiness(); // 지운 후 0원으로 연산 반영
    });
  }

  // 4. 탭 버튼 클릭 (모드 전환)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.tab-btn');
      if (!targetBtn) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      currentMode = targetBtn.getAttribute('data-mode');

      // 라벨 및 플레이스홀더 동적 변경
      if (amountLabel) {
        amountLabel.innerText = currentMode === 'GROSS_TO_NET'
          ? '총 지급액 (세전) (원)'
          : '실 지급액 (세후) (원)';
      }
      if (amountInput) {
        amountInput.placeholder = currentMode === 'GROSS_TO_NET'
          ? '세전 금액 입력'
          : '실 지급액 입력';
      }

      // 탭 전환 즉시 연산
      calculateBusiness();
    });
  });

  // 최초 1회 화면 로딩 시 자동 계산 실행
  calculateBusiness();
});

// 10원 단위 절사 공통 함수
function getTaxes(gross) {
  const incomeTax = Math.floor((gross * 0.03) / 10) * 10;
  const localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
  return { incomeTax, localTax, totalTax: incomeTax + localTax };
}

// 메인 계산 로직
function calculateBusiness() {
  const amountInput = document.getElementById('amount');
  if (!amountInput) return;

  const inputVal = Number(amountInput.value.replace(/[^0-9]/g, '')) || 0;
  
  let gross = 0;
  let net = 0;
  let taxes = { incomeTax: 0, localTax: 0, totalTax: 0 };

  if (inputVal > 0) {
    if (currentMode === 'GROSS_TO_NET') {
      // 지급 계산기 (세전 -> 세후)
      gross = inputVal;
      taxes = getTaxes(gross);
      net = gross - taxes.totalTax;
    } else {
      // 역산 계산기 (세후 -> 세전)
      net = inputVal;
      let low = net;
      let high = net * 1.5; 
      let bestGross = net;

      // 이분 탐색(Binary Search)
      for (let i = 0; i < 60; i++) {
        const mid = Math.floor((low + high) / 2);
        const calcTaxes = getTaxes(mid);
        const calcNet = mid - calcTaxes.totalTax;

        if (Math.abs(calcNet - net) < 0.5) {
          bestGross = mid;
          break;
        } else if (calcNet < net) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      
      gross = Math.round(bestGross);
      taxes = getTaxes(gross);
      
      // 10원 절사로 인한 오차 미세 보정 (While 루프)
      let finalNet = gross - taxes.totalTax;
      while (finalNet < net) {
        gross++;
        taxes = getTaxes(gross);
        finalNet = gross - taxes.totalTax;
      }
      while (finalNet > net) {
        gross--;
        taxes = getTaxes(gross);
        finalNet = gross - taxes.totalTax;
        if (finalNet < net) {
          gross++;
          taxes = getTaxes(gross);
          break;
        }
      }
    }
  }

  // 화면 UI 업데이트
  const fmt = (num) => num.toLocaleString('ko-KR');

  document.getElementById('resIncomeTax').innerText = fmt(taxes.incomeTax) + ' 원';
  document.getElementById('resLocalTax').innerText = fmt(taxes.localTax) + ' 원';
  document.getElementById('resTotalTax').innerText = fmt(taxes.totalTax) + ' 원';

  // 모드에 따라 상하단 타이틀과 금액 스위칭
  if (currentMode === 'GROSS_TO_NET') {
    document.getElementById('resMainTitle').innerText = '실 지급액 (차인지급액)';
    document.getElementById('resMainAmount').innerText = fmt(net) + ' 원';
    
    document.getElementById('resSubTitle').innerText = '기준 총 지급액 (세전)';
    document.getElementById('resSubAmount').innerText = fmt(gross) + ' 원';
  } else {
    document.getElementById('resMainTitle').innerText = '필요 총 지급액 (세전)';
    document.getElementById('resMainAmount').innerText = fmt(gross) + ' 원';
    
    document.getElementById('resSubTitle').innerText = '목표 실 지급액 (세후)';
    document.getElementById('resSubAmount').innerText = fmt(net) + ' 원';
  }
}