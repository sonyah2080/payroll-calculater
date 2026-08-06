let currentMode = 'NET_TO_GROSS';

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const amountLabel = document.getElementById('amountLabel');
  const amountInput = document.getElementById('amount');
  const taxFreeInput = document.getElementById('taxFree');
  const btnCalculate = document.getElementById('btnCalculate');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '세전 급여 (원)';
    });
  });

  const attachCommaFormatter = (inputEl) => {
    inputEl.addEventListener('input', (e) => {
      const cursorPosition = e.target.selectionStart;
      const originalLength = e.target.value.length;
      
      let digitsOnly = e.target.value.replace(/[^0-9]/g, '');
      if (digitsOnly === '') {
        e.target.value = '';
        return;
      }

      const formatted = Number(digitsOnly).toLocaleString();
      e.target.value = formatted;

      const newLength = formatted.length;
      const newCursor = Math.max(0, cursorPosition + (newLength - originalLength));
      e.target.setSelectionRange(newCursor, newCursor);
    });
  };

  attachCommaFormatter(amountInput);
  attachCommaFormatter(taxFreeInput);

  btnCalculate.addEventListener('click', calculate);
});

const parseCurrency = str => parseFloat(str.replace(/,/g, '')) || 0;
const floor10 = val => Math.floor(val / 10) * 10;

function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  const taxFree = parseCurrency(document.getElementById('taxFree').value);
  const dependents = parseInt(document.getElementById('dependents').value) || 1;

  let gross = 0, net = 0;
  let np = 0, hi = 0, lt = 0, ei = 0, it = 0, localTax = 0, totalDed = 0;

  function compute(g) {
    const taxable = Math.max(0, g - taxFree);
    
    np = floor10(Math.min(taxable, 6170000) * 0.045);
    hi = floor10(taxable * 0.03545);
    lt = floor10(hi * 0.1295);
    ei = floor10(taxable * 0.009);

    let base = Math.max(0, taxable - (dependents - 1) * 100000);
    let rawIt = 0;
    if (base <= 1060000) rawIt = 0;
    else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
    else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
    else rawIt = 320000 + (base - 5000000) * 0.22;
    
    it = floor10(rawIt);
    localTax = floor10(it * 0.1);

    totalDed = np + hi + lt + ei + it + localTax;
    net = g - totalDed;
  }

  if (currentMode === 'GROSS_TO_NET') {
    gross = amount;
    compute(gross);
  } else {
    let low = amount, high = amount * 1.6;
    for (let i = 0; i < 40; i++) {
      gross = (low + high) / 2;
      compute(gross);
      if (Math.abs(net - amount) < 1) break;
      if (net < amount) low = gross; else high = gross;
    }
    gross = Math.round(gross);
    compute(gross);
  }

  const fmt = num => Math.round(num).toLocaleString() + ' 원';

  // Net -> Gross 계산 모드일 때 세전 금액과 목표 실수령액 간의 차액(추가 필요 세전 금액) 계산
  const extraAmount = currentMode === 'NET_TO_GROSS' ? (gross - amount) : totalDed;

  document.getElementById('resultBox').style.display = 'block';
  
  if (currentMode === 'NET_TO_GROSS') {
    document.getElementById('extraRow').style.display = 'flex';
    document.getElementById('resExtraAmount').innerText = fmt(extraAmount);
  } else {
    document.getElementById('extraRow').style.display = 'none'; // Gross->Net 계산 시 숨김
  }

  document.getElementById('resMainTitle').innerText = currentMode === 'NET_TO_GROSS' ? '예상 세전 급여' : '예상 실수령액';
  document.getElementById('resMainAmount').innerText = fmt(currentMode === 'NET_TO_GROSS' ? gross : net);
  document.getElementById('resDeduction').innerText = fmt(totalDed);

  document.getElementById('resNp').innerText = fmt(np);
  document.getElementById('resHi').innerText = fmt(hi);
  document.getElementById('resLt').innerText = fmt(lt);
  document.getElementById('resEi').innerText = fmt(ei);
  document.getElementById('resIt').innerText = fmt(it);
  document.getElementById('resLtTax').innerText = fmt(localTax);
}