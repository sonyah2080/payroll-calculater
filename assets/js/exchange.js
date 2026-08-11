document.addEventListener('DOMContentLoaded', () => {
    // HTML 요소 가져오기
    const inputs = document.querySelectorAll('.num-input');
    
    // ✨ 라디오 버튼 대신 탭 버튼 요소 가져오기
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

    // 숫자 콤마 및 형변환 유틸리티
    const fmt = (num) => Math.round(num).toLocaleString('ko-KR');
    const getNum = (str) => Number(str.replace(/,/g, '')) || 0;

    // 1. 한국수출입은행 환율 API 호출 함수 (프록시 우회 적용 완결판)
    async function fetchExchangeRate(date, currencyCode = "USD") {
        const authKey = "DCHUv43PJEUeuIrq44VFnFpl8EfETo5cY"; 
        
        // 원본 수출입은행 API 주소
        const targetUrl = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${authKey}&searchdate=${date}&data=AP01`;
        
        // ✨ 해결책: 무료 CORS 프록시 서버(allorigins)를 거쳐서 호출하도록 URL 변경
        // 브라우저가 직접 은행을 찌르지 않아 보안 차단(CORS)을 피할 수 있습니다!
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('네트워크 오류가 발생했습니다.');
            
            // allorigins 우회 서버는 진짜 데이터를 .contents 안에 포장해서 줍니다.
            const proxyData = await response.json();
            
            // 포장지를 뜯고 진짜 JSON 데이터로 변환
            const data = JSON.parse(proxyData.contents);
            
            if (!Array.isArray(data) || data.length === 0) return null;

            // 매뉴얼에 따른 에러코드 방어 로직 (1이 정상)
            if (data[0].result && data[0].result !== 1) {
                console.error("API 오류 발생. Result Code:", data[0].result);
                if (data[0].result === 3) alert("API 인증키가 유효하지 않습니다.");
                if (data[0].result === 4) alert("API 일일 호출 횟수(1000회)를 초과했습니다.");
                return null;
            }
            
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

    // 3. 날짜 선택 시 API 연동
    async function handleDateSelect(event, targetRateInput) {
        const dateVal = event.target.value;
        if (!dateVal) return;
        
        const formattedDate = dateVal.replace(/-/g, '');
        targetRateInput.value = "불러오는 중...";
        
        const rate = await fetchExchangeRate(formattedDate, "USD");
        
        if (rate !== null) {
            targetRateInput.value = fmt(rate);
            calculateMain(); 
        } else {
            targetRateInput.value = "";
            alert("해당 날짜의 환율 데이터를 불러올 수 없습니다.\n(주말/공휴일이거나 11시 이전인 경우 직접 입력해주세요.)");
        }
    }

    // 4. 메인 실시간 계산 로직
    function calculateMain() {
        // ✨ 활성화된(active) 탭 버튼의 data-mode 값을 가져옴
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

    // ✨ 탭 버튼 클릭 이벤트 바인딩
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 모든 탭에서 active 제거 후 클릭한 탭에만 추가
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // 탭이 변경되었으므로 즉시 재계산
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