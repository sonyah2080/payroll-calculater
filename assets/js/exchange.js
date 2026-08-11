document.addEventListener('DOMContentLoaded', () => {
    // HTML 요소 가져오기
    const inputs = document.querySelectorAll('.num-input');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    const elCurrency = document.getElementById('currency_select');
    const elAmount = document.getElementById('foreign_amount');
    const elInvoiceDate = document.getElementById('invoice_date');
    const elInvoiceRate = document.getElementById('invoice_rate');
    const elPaymentDate = document.getElementById('payment_date');
    const elPaymentRate = document.getElementById('payment_rate');
    
    const resInvoice = document.getElementById('res_invoice_krw');
    const resPayment = document.getElementById('res_payment_krw');
    const resLabel = document.getElementById('res_type_label');
    const resDiff = document.getElementById('res_diff_krw');

    // 숫자 콤마 및 형변환 유틸리티 (원화용: 정수, 환율용: 소수점 2자리 보존)
    const fmtKrw = (num) => Math.round(num).toLocaleString('ko-KR');
    const fmtRate = (num) => Number(num).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const getNum = (str) => Number(String(str).replace(/,/g, '')) || 0;

    // 1. 선택한 통화와 날짜에 따른 환율 가져오기 API
    async function fetchExchangeRate(dateVal, currencyCode = 'usd') {
        const curr = currencyCode.toLowerCase();
        // 날짜별 API URL (usd, jpy, eur 등 지원)
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateVal}/v1/currencies/${curr}.json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("데이터 없음");
            
            const data = await response.json();
            return data[curr].krw; // 1 외화당 KRW 환율 반환
        } catch (error) {
            console.error("API 통신 에러:", error);
            return null;
        }
    }

    // 2. 외환차익/차손 계산 함수
    function calculateFxGainLoss(type, amount, invoiceRate, paymentRate) {
        let difference = 0;
        
        if (type === 'export') { 
            difference = (paymentRate - invoiceRate) * amount;
        } else if (type === 'import') { 
            difference = (invoiceRate - paymentRate) * amount;
        }

        const gainLossType = difference > 0 ? "🎉 외환차익 (이익)" : (difference < 0 ? "📉 외환차손 (손실)" : "차이 없음");
        const formattedAmount = Math.abs(difference).toLocaleString('ko-KR', { maximumFractionDigits: 0 });

        return {
            type: gainLossType,
            amountKRW: formattedAmount,
            isGain: difference > 0,
            isZero: difference === 0
        };
    }

    // 3. 날짜 선택 시 이벤트 핸들러 (통화 정보 포함)
    async function handleDateSelect(dateInput, targetRateInput) {
        const dateVal = dateInput.value;
        if (!dateVal) return;
        
        const selectedCurrency = elCurrency ? elCurrency.value : 'usd';
        targetRateInput.value = "불러오는 중...";
        
        const rate = await fetchExchangeRate(dateVal, selectedCurrency);
        
        if (rate !== null) {
            // 환율 소수점 표기 보존 (예: JPY 9.15, USD 1385.50)
            targetRateInput.value = fmtRate(rate);
            calculateMain(); 
        } else {
            targetRateInput.value = "";
            alert("해당 날짜의 환율 데이터를 불러올 수 없습니다.\n(미래 날짜이거나 데이터가 없는 경우 직접 입력해주세요.)");
        }
    }
// 4. 메인 실시간 계산 로직
function calculateMain() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) return;
    
    const type = activeTab.dataset.mode;
    const amount = getNum(elAmount.value);
    const invRate = getNum(elInvoiceRate.value);
    const payRate = getNum(elPaymentRate.value);

    const invKrw = amount * invRate;
    const payKrw = amount * payRate;

    // 원화 환산금액 표시
    resInvoice.textContent = invKrw > 0 ? fmtKrw(invKrw) + " 원" : "0 원";
    resPayment.textContent = payKrw > 0 ? fmtKrw(payKrw) + " 원" : "0 원";

    // ✨ 색상 클래스 리셋 (이전 적용된 val-gain, val-loss 확실히 삭제)
    resDiff.classList.remove('val-gain', 'val-loss');

    // 입력값이 하나라도 없거나 0일 때는 초기 상태 (-) 유지를 위해 종료
    if (amount === 0 || invRate === 0 || payRate === 0) {
        resLabel.textContent = "결과 정산 중";
        resDiff.textContent = "-";
        return;
    }

    const result = calculateFxGainLoss(type, amount, invRate, payRate);

    if (result.isZero) {
        resLabel.textContent = "외환 차이:";
        resDiff.textContent = "0 원";
    } else {
        resLabel.textContent = result.type;
        resDiff.textContent = (result.isGain ? "+" : "-") + result.amountKRW + " 원";
        
        // ✨ 이익/손실 여부에 따른 색상 클래스 부여
        if (result.isGain) {
            resDiff.style.setProperty('color', 'var(--green-400, #16a34a)', 'important');
        } else {
            resDiff.style.setProperty('color', 'var(--red-400, #dc2626)', 'important');
        }
    }
}
    // 5. 이벤트 바인딩

    // 탭 버튼 클릭
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            calculateMain();
        });
    });

    // 통화 변경 시 날짜가 이미 입력되어 있으면 환율 재조회
    if (elCurrency) {
        elCurrency.addEventListener('change', () => {
            if (elInvoiceDate.value) handleDateSelect(elInvoiceDate, elInvoiceRate);
            if (elPaymentDate.value) handleDateSelect(elPaymentDate, elPaymentRate);
            calculateMain();
        });
    }

    // 날짜 변경 이벤트
    elInvoiceDate.addEventListener('change', () => handleDateSelect(elInvoiceDate, elInvoiceRate));
    elPaymentDate.addEventListener('change', () => handleDateSelect(elPaymentDate, elPaymentRate));

    // 숫자 입력창 천단위 콤마 및 실시간 계산 연결
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^0-9.]/g, '');
            if (val) {
                const parts = val.split('.');
                parts[0] = parseInt(parts[0], 10 || 0).toLocaleString('ko-KR');
                if (parts.length > 1) {
                    this.value = parts[0] + '.' + parts[1].slice(0, 2); // 소수점 2자리까지만 허용
                } else {
                    this.value = parts[0];
                }
            }
            calculateMain(); // 입력할 때마다 실시간 계산
        });
    });
});