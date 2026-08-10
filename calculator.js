let currentMode = 'NET_TO_GROSS';

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const amountLabel = document.getElementById('amountLabel');
  const amountInput = document.getElementById('amount');
  const taxFreeInput = document.getElementById('taxFree');
  const btnCalculate = document.getElementById('btnCalculate');
  const chkTax = document.getElementById('chkTax');
  const dependentsGroup = document.getElementById('dependentsGroup');
  const taxRateGroup = document.getElementById('taxRateGroup');
  const taxRateSelect = document.getElementById('taxRateSelect');
  const taxRateCustom = document.getElementById('taxRateCustom');

  chkTax.addEventListener('change', (e) => {
    const show = e.target.checked;
    dependentsGroup.style.display = show ? 'block' : 'none';
    taxRateGroup.style.display = show ? 'block' : 'none';
  });

  taxRateSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      taxRateCustom.style.display = 'block';
      taxRateCustom.focus();
    } else {
      taxRateCustom.style.display = 'none';
    }
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMode = e.target.getAttribute('data-mode');
      amountLabel.innerText = currentMode === 'NET_TO_GROSS' ? '목표 실수령액 (원)' : '세전 급여 (원)';
    });
  });

  attachFormatter(amountInput);
  attachFormatter(taxFreeInput);

  btnCalculate.addEventListener('click', (e) => {
    e.preventDefault();
    calculate();
  });
});

function getSelectedTaxPercent() {
  const isTaxChecked = document.getElementById('chkTax').checked;
  if (!isTaxChecked) return 0;

  const selectVal = document.getElementById('taxRateSelect').value;
  if (selectVal === 'custom') {
    return parseFloat(document.getElementById('taxRateCustom').value) || 0;
  }
  return parseFloat(selectVal) || 0;
}

function computeDeductions(g) {
  const taxFree = parseCurrency(document.getElementById('taxFree').value);
  const dependents = parseInt(document.getElementById('dependents').value) || 1;

  const isNpChecked = document.getElementById('chkNp').checked;
  const isHiChecked = document.getElementById('chkHi').checked;
  const isEiChecked = document.getElementById('chkEi').checked;
  const isTaxChecked = document.getElementById('chkTax').checked;
  const taxRatePercent = getSelectedTaxPercent() / 100;

  const taxable = Math.max(0, g - taxFree);
  
  const np = isNpChecked ? floor10(Math.min(taxable, 6170000) * 0.045) : 0;
  const hi = isHiChecked ? floor10(taxable * 0.03545) : 0;
  const lt = isHiChecked ? floor10(hi * 0.1295) : 0;
  const ei = isEiChecked ? floor10(taxable * 0.009) : 0;

  let it = 0, localTax = 0;
  if (isTaxChecked && taxRatePercent > 0) {
    let base = Math.max(0, taxable - (dependents - 1) * 100000);
    let rawIt = 0;
    if (base <= 1060000) rawIt = 0;
    else if (base <= 3000000) rawIt = (base - 1000000) * 0.04;
    else if (base <= 5000000) rawIt = 80000 + (base - 3000000) * 0.12;
    else rawIt = 320000 + (base - 5000000) * 0.22;
    
    it = floor10(rawIt * taxRatePercent);
    localTax = floor10(it * 0.1);
  }

  const totalDed = np + hi + lt + ei + it + localTax;
  return { np, hi, lt, ei, it, localTax, totalDed };
}

function calculate() {
  const amount = parseCurrency(document.getElementById('amount').value);
  let gross = 0;

  if (currentMode === 'GROSS_TO_NET') {
    gross = amount;
  } else {
    let low = amount, high = amount * 1.6;
    for (let i = 0; i < 40; i++) {
      gross = (low + high) / 2;
      const ded = computeDeductions(gross);
      const net = gross - ded.totalDed;
      if (Math.abs(net - amount) < 1) break;
      if (net < amount) low = gross; else high = gross;
    }
    gross = Math.round(gross);
  }

  const ded = computeDeductions(gross);
  const net = gross - ded.totalDed;

  applyValuesToUI(gross, ded, net);
}

function applyValuesToUI(gross, ded, net) {
  const isTaxChecked = document.getElementById('chkTax').checked;
  const taxPercent = getSelectedTaxPercent();
  
  document.getElementById('lblIt').innerText = isTaxChecked ? `소득세 (${taxPercent}% 적용)` : '소득세 (미적용)';

  document.getElementById('resMainAmount').innerText = fmt(gross);
  document.getElementById('resExtraDiff').innerText = fmt(ded.totalDed);

  document.getElementById('resNp').innerText = fmt(ded.np);
  document.getElementById('resHi').innerText = fmt(ded.hi);
  document.getElementById('resEi').innerText = fmt(ded.ei);
  document.getElementById('resLt').innerText = fmt(ded.lt);
  document.getElementById('resIt').innerText = fmt(ded.it);
  document.getElementById('resLtTax').innerText = fmt(ded.localTax);

  document.getElementById('resDeduction').innerText = fmt(ded.totalDed);
  document.getElementById('resNetAmount').innerText = fmt(net);

  const extraRow = document.getElementById('extraRow');

  if (currentMode === 'NET_TO_GROSS') {
    document.getElementById('resMainTitle').innerText = '예상 세전 급여';
    extraRow.classList.remove('hidden');
  } else {
    document.getElementById('resMainTitle').innerText = '입력 세전 급여';
    extraRow.classList.add('hidden');
  }

  const resultBox = document.getElementById('resultBox');
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
