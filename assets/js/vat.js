/**
 * ============================================================================
 * 부가가치세(VAT) 실시간 자동 계산 모듈 (vat.js)
 * - 한 번에 지우기(Clear) 버튼 기능 추가
 * ============================================================================
 */

let currentVatMode = 'TOTAL_TO_VAT';

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const amountLabel = document.getElementById('amountLabel');
  const amountInput = document.getElementById('amount');
  const btnClearAmount = document.getElementById('btnClearAmount');
  const vatCutUnit = document.getElementById('vatCutUnit');

  // 1. 천단위 콤마 자동 포맷터 연동
  if (typeof attachFormatter === 'function' && amountInput) {
    attachFormatter(amountInput);
  }

  // 2. 실시간 입력 반응 (금액 입력 시)
  if (amountInput) {
    amountInput.addEventListener('input', calculateVat);
    amountInput.addEventListener('keyup', calculateVat);
  }

  // 3. 💡 금액 한 번에 지우기 버튼 클릭 처리
  if (btnClearAmount && amountInput) {
    btnClearAmount.addEventListener('click', () => {
      amountInput.value = '';
      amountInput.focus();
      calculateVat(); // 지운 후 실시간 연산 (0원 처리)
    });
  }

  // 4. 서브 탭 전환
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentVatMode = e.target.getAttribute('data-mode');

      if (amountLabel) {
        amountLabel.innerText = currentVatMode === 'TOTAL_TO_VAT' 
          ? '합계 금액 (공급대가, VAT 포함) (원)' 
          : '공급가액 (세전 금액) (원)';
      }
      
      calculateVat();
    });
  });

  // 5. 절사 단위 드롭다운 변경 시
  if (vatCutUnit) {
    vatCutUnit.addEventListener('change', calculateVat);
  }

  // 최초 1회 연산
  calculateVat();
});

/**
 * 부가가치세 실시간 연산 및 UI 바인딩 함수
 */
function calculateVat() {
  const amountInput = document.getElementById('amount');
  if (!amountInput) return;

  const amount = parseCurrency(amountInput.value) || 0;
  const vatCutUnit = document.getElementById('vatCutUnit');
  const cutUnit = vatCutUnit ? parseInt(vatCutUnit.value, 10) : 1;

  let supplyValue = 0;
  let vatValue = 0;
  let totalAmount = 0;

  if (currentVatMode === 'TOTAL_TO_VAT') {
    totalAmount = amount;
    let rawSupply = (totalAmount * 10) / 11;

    if (cutUnit === 1) {
      supplyValue = Math.floor(Math.round(rawSupply * 1000) / 1000);
    } else if (cutUnit === 10) {
      supplyValue = Math.floor((Math.round(rawSupply * 1000) / 1000) / 10) * 10;
    } else {
      supplyValue = Math.round(rawSupply);
    }

    vatValue = totalAmount - supplyValue; 
  } else {
    supplyValue = amount;
    let rawVat = supplyValue * 0.1;

    if (cutUnit === 1) {
      vatValue = Math.floor(rawVat);
    } else if (cutUnit === 10) {
      vatValue = Math.floor(rawVat / 10) * 10;
    } else {
      vatValue = Math.round(rawVat);
    }

    totalAmount = supplyValue + vatValue;
  }

  const resMainAmount = document.getElementById('resMainAmount');
  const resSupplyValue = document.getElementById('resSupplyValue');
  const resVatValue = document.getElementById('resVatValue');

  if (resMainAmount) resMainAmount.innerText = fmt(totalAmount);
  if (resSupplyValue) resSupplyValue.innerText = fmt(supplyValue);
  if (resVatValue) resVatValue.innerText = fmt(vatValue);

  const resMainTitle = document.getElementById('resMainTitle');
  if (resMainTitle) {
    resMainTitle.innerText = currentVatMode === 'TOTAL_TO_VAT' ? '총 합계 금액 (공급대가)' : '계산된 총 합계 금액';
  }
}