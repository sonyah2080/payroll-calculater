document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.num-input');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    const elAmount = document.getElementById('foreign_amount');
    const elInvoiceDate = document.getElementById('invoice_date');
    const elInvoiceRate = document.getElementById('invoice_rate');
    const elPaymentDate = document.getElementById('payment_date');
    const elPaymentRate = document.getElementById('payment_rate');
    
    const resInvoice = document.getElementById('res_invoice_krw');
    const resPayment = document.getElementById('res_payment_krw');
    const resLabel = document.getElementById('res_type_label');
    const resDiff = document.getElementById('res_diff_krw');

    const fmt = (num) => Math.round(num).toLocaleString('ko-KR');
    const getNum = (str) => Number(str.replace(/,/g, '')) || 0;

    // 1. 한국수출입은행 환율 API 호출 함수 (구글 시트 웹 앱 경유)
    async function fetchExchangeRate(dateStr, currencyCode = "USD") {
        // dateStr 형태 ("2026-02-12")를 API 규격("20260212")으로 변환
        const searchDate = dateStr.replace(/-/g, '');
        
        // ✨ 대표님이 주신 배포 ID가 포함된 구글 시트 웹 앱 URL
        const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxWtviPTWeShdXVbWldlN63HEhimeSaot1PO_N4Jdaq-_zSq5jRFq9ZrkC1-3UBGFqiBg/exec";
        
        const url = `${googleScriptUrl}?date=${searchDate}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('네트워크 응답이 정상이 아닙니다.');
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) return null;

            // 수출입은행 API 에러 코드 방어 (1이 정상)
            if (data[0].result && data[0].result !== 1) {
                console.error("API 데이터 없음 또는 주말/공휴일");
                return null;
            }
            
            // 해당 통화(USD 등)의 매매기준율(deal_bas_r) 추출
            const rateInfo = data.find(item => item.cur_unit === currencyCode);
            if (rateInfo && rateInfo.deal_bas_r) {
                return parseFloat(rateInfo.deal_bas_r.replace(/,/g, ''));
            }
            return null;
        } catch (error) {
            console.error("환율 정보를 불러오는 데 실패했습니다.", error);
            return null;
        }
    }

    // 2. 외환차익/차손 계산 함수
    function calculateFxGainLoss(type, amount, invoiceRate, paymentRate) {
        let difference = 0;
        
        if (type === 'export') { 
            difference = (paymentRate - invoiceRate) * amount; // 수출: 결제일 환율이 높으면 이익
        } else if (type === 'import') { 
            difference = (invoiceRate - paymentRate) * amount; // 수입: 발생일 환율이 높으면(결제일이 낮으면) 이익
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

    // 3. 날짜 선택 시 자동으로 구글 시트를 통해 환율을 가져오는 함수
    async function handleDateSelect(event, targetRateInput) {
        const dateVal = event.target.value; // "YYYY-MM-DD"
        if (!dateVal) return;
        
        targetRateInput.value = "불러오는 중...";
        
        const rate = await fetchExchangeRate(dateVal, "USD");
        
        if (rate !== null) {
            targetRateInput.value = fmt(rate);
            calculateMain(); // 환율 수신 후 즉시 계산 실행
        } else {
            targetRateInput.value = "";
            alert("해당 날짜의 환율 데이터를 불러올 수 없습니다.\n(주말/공휴일은 환율 데이터가 없으니 직접 입력해 주세요.)");
        }
    }

    // 4. 메인 실시간 연산 로직
    function calculateMain() {
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab) return;
        
        const type = activeTab.dataset.mode; // 'export' 또는 'import'
        const amount = getNum(elAmount.value);
        const invRate = getNum(elInvoiceRate.value);
        const payRate = getNum(elPaymentRate.value);

        const invKrw = amount * invRate;
        const payKrw = amount * payRate;

        resInvoice.textContent = fmt(invKrw) + " 원";
        resPayment.textContent = fmt(payKrw) + " 원";

        const result = calculateFxGainLoss(type, amount, invRate, payRate);

        resDiff.className = 'num font-bold'; 

        if (amount === 0 || invRate === 0 || payRate === 0) {
            resLabel.textContent = "외환차익/차손:";
            resDiff.textContent = "0 원";
        } else if (result.isZero) {
            resLabel.textContent = result.type + ":";
            resDiff.textContent = "0 원";
        } else {
            resLabel.textContent = result.type + ":";
            resDiff.textContent = (result.isGain ? "+" : "-") + result.amountKRW + " 원";
            resDiff.classList.add(result.isGain ? 'val-gain' : 'val-loss');
        }
    }

    // 탭 버튼 클릭 이벤트 바인딩
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            calculateMain();
        });
    });

    // 이벤트 리스너 연결
    elInvoiceDate.addEventListener('change', (e) => handleDateSelect(e, elInvoiceRate));
    elPaymentDate.addEventListener('change', (e) => handleDateSelect(e, elPaymentRate));

    inputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let val = this.value.replace(/[^0-9.]/g, '');
            if(val) {
                const parts = val.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('ko-KR');
                this.value = parts.join('.');
            }
            calculateMain();
        });
    });
});