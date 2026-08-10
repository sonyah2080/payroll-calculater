// 통화 숫자 포맷팅 유틸리티
const parseCurrency = str => parseFloat((str || '').toString().replace(/,/g, '')) || 0;
const floor10 = val => Math.floor(val / 10) * 10;
const fmt = num => Math.round(num).toLocaleString() + ' 원';

// 입력창 천단위 콤마 및 키패드 + 키 지원 함수 (000 자동 입력)
const attachFormatter = (inputEl) => {
  if (!inputEl) return;
  
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.code === 'NumpadAdd') {
      e.preventDefault();
      const start = inputEl.selectionStart, end = inputEl.selectionEnd, val = inputEl.value;
      const newVal = val.substring(0, start) + '000' + val.substring(end);
      const digits = newVal.replace(/[^0-9]/g, '');
      if(!digits){ inputEl.value = ''; return; }
      const formatted = Number(digits).toLocaleString();
      inputEl.value = formatted;
      const newCursor = Math.min(start + 4, formatted.length);
      inputEl.setSelectionRange(newCursor, newCursor);
    }
  });

  inputEl.addEventListener('input', (e) => {
    let digits = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = digits ? Number(digits).toLocaleString() : '';
  });
};
