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
      if (!digits) { inputEl.value = ''; return; }
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
    { name: '사업소득 계산기', link: 'freelancer.html' },
    { name: '퇴직금 계산기', link: 'severance.html' },
    { name: '일할 계산기', link: 'prorated.html' },
    { name: '부가세 계산기', link: 'vat.html' },
    { name: '환율 계산기', link: 'exchange.html' },
    { name: '가산세 계산기', link: 'penalty.html' },
    // 💡 나중에 여기에 { name: '급여대장', link: 'ledger.html' } 를 추가하시면 4x2 배열이 완벽하게 꽉 찹니다!
  ];

  // 💡 4개씩 2줄(4x2) 그리드 레이아웃 스타일을 JS에서 직접 주입
  const navHtml = `
    <style>
      .header-nav-wrapper {
        margin-bottom: 24px;
      }
      .top-nav-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr); /* PC: 4개씩 배치 */
        gap: 8px;
        background: #f1f5f9;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
      }
      .top-nav-grid .nav-tab {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 4px;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        background: transparent;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.2s ease;
        text-align: center;
        word-break: keep-all; /* 단어 단위로 줄바꿈 방지 */
      }
      .top-nav-grid .nav-tab:hover {
        background: #e2e8f0;
        color: #334155;
      }
      .top-nav-grid .nav-tab.active {
        background: #ffffff;
        color: #2563eb;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        font-weight: 800;
      }
      /* 📱 모바일 화면에서는 2개씩 4줄로 자동 변환 */
      @media (max-width: 600px) {
        .top-nav-grid {
          grid-template-columns: repeat(2, 1fr); 
        }
      }
    </style>
    
    <div class="header-nav-wrapper">
      <nav class="top-nav-grid">
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
// // 공통 상단 헤더 탭 동적 생성 함수
// function renderHeader() {
//   const headerEl = document.getElementById('mainHeader');
//   if (!headerEl) return;

//   // 현재 접속한 페이지 파일명 확인
//   const currentPath = window.location.pathname.split('/').pop() || 'index.html';

//   // 메뉴 데이터 배열 (추후 메뉴 추가/수정 시 여기만 변경)
//   const menuItems = [
//     { name: '급여 계산기', link: 'index.html' },
//     { name: '사업소득 계산기', link: 'freelancer.html' },
//     { name: '퇴직금 계산기', link: 'severance.html' },
//     { name: '일할 계산기', link: 'prorated.html' },
//     { name: '부가세 계산기', link: 'vat.html' },
//     { name: '환율 계산기', link: 'exchange.html' },
//     { name: '가산세 계산기', link: 'penalty.html' },
//   ];

//   // 모든 페이지에서 동일한 너비와 중앙 정렬을 유지하도록 wrapper 구성
//   const navHtml = `
//     <div class="header-nav-wrapper">
//       <nav class="top-nav">
//         ${menuItems.map(item => `
//           <a href="${item.link}" class="nav-tab ${currentPath === item.link ? 'active' : ''}">
//             ${item.name}
//           </a>
//         `).join('')}
//       </nav>
//     </div>
//   `;

//   headerEl.innerHTML = navHtml;
// }

// DOM 로드 완료 시 헤더 자동 실행
document.addEventListener('DOMContentLoaded', renderHeader);


// common.js 최하단에 추가

document.addEventListener("DOMContentLoaded", function () {
  renderFooter();
});

function renderFooter() {
  const footerContainer = document.getElementById("mainFooter");
  if (!footerContainer) return;

  const currentYear = new Date().getFullYear();

  footerContainer.innerHTML = `
    <footer class="footer">
      <p class="copyright">© ${currentYear} wayer. All rights reserved.
      <p class="disclaimer">본 계산 결과는 법적 효력을 갖지 않으며 참고용으로만 활용 가능합니다.</p>
    </footer>
  `;
}

/**
 * ============================================================================
 * 공통 날짜 입력창 모듈 (숫자 자동 하이픈 + 투명 달력 동기화)
 * ============================================================================
 */
function initGlobalDateInputs() {
  // 1. .date-text-input 클래스가 붙은 입력창에 숫자 입력 시 YYYY-MM-DD 자동 변환
  const dateInputs = document.querySelectorAll('.date-text-input');
  
  dateInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 8) val = val.substring(0, 8);

      if (val.length >= 5 && val.length <= 6) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4);
      } else if (val.length >= 7) {
        e.target.value = val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6);
      } else {
        e.target.value = val;
      }
    });
  });

  // 2. .date-input-wrapper 내부의 텍스트창과 투명 달력(input[type="date"]) 연동
  const wrappers = document.querySelectorAll('.date-input-wrapper');
  wrappers.forEach(wrapper => {
    const textInput = wrapper.querySelector('input[type="text"]');
    const pickerInput = wrapper.querySelector('input[type="date"]');

    if (textInput && pickerInput) {
      pickerInput.addEventListener('change', (e) => {
        textInput.value = e.target.value;
        // 동적으로 연산이 필요한 계산기들을 위해 input 이벤트 강제 발생
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  });
}

// DOM 로드 완료 시 전역 자동 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
  initGlobalDateInputs();
});