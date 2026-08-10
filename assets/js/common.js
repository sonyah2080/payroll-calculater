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

// 공통 상단 헤더 탭 동적 생성 함수
function renderHeader() {
  const headerEl = document.getElementById('mainHeader');
  if (!headerEl) return;

  // 현재 접속한 페이지 파일명 확인
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // 메뉴 데이터 배열 (추후 메뉴 추가/수정 시 여기만 변경)
  const menuItems = [
    { name: '급여 계산기', link: 'index.html' },
    { name: '퇴직금 계산기', link: 'severance.html' },
    { name: '일할 계산기', link: 'prorated.html' },
    { name: '부가세 계산기', link: 'vat.html' }
  ];

// 모든 페이지에서 동일한 너비와 중앙 정렬을 유지하도록 wrapper 구성
  const navHtml = `
    <div class="header-nav-wrapper">
      <nav class="top-nav">
        ${menuItems.map(item => `
          <a href="${item.link}" class="nav-tab ${currentPath === item.link ? 'active' : ''}">
            ${item.name}
          </a>
        `).join('')}
      </nav>
    </div>
  `;

  headerEl.innerHTML = navHtml;
}

// DOM 로드 완료 시 헤더 자동 실행
document.addEventListener('DOMContentLoaded', renderHeader);
