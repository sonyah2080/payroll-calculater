/**
 * ============================================================================
 * 4대보험 요율 및 소득세/간이세액표 통합 관리 모듈 (taxTable.js)
 * * - 2026년 기준 4대보험 및 국세청 근로소득 간이세액표 기준 설정
 * - 세액표에 없는 고소득/세밀한 구간은 국세청 공식 산식을 통해 자동 계산
 * ============================================================================
 */

// 1. 4대보험 및 세금 요율 설정 (2026년 기준 최신 개정 요율)
const RATES_CONFIG = {
  // 국민연금 (근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,   // 국민연금 기준소득월액 하한선 (이 이하로 벌어도 이 기준으로 계산)
    MAX_BASE: 6170000   // 국민연금 기준소득월액 상한선 (이 이상 벌어도 이 기준으로 계산)
  },
  // 건강보험 (근로자 부담분 3.595%)
  HI: {
    RATE: 0.03595
  },
  // 장기요양보험 (건강보험료 산출액의 13.14%)
  LT: {
    RATE_OF_HI: 0.1314
  },
  // 고용보험 (실업급여 근로자 부담분 0.9%)
  EI: {
    RATE: 0.009
  },
  // 지방소득세 (근로소득세의 10%)
  LOCAL_TAX: {
    RATE: 0.10
  }
};

// 2. 국세청 근로소득 간이세액표 핵심 구간 데이터 (단위: 원)
// 구조: { min: 이상, max: 미만, taxes: [1인, 2인, 3인, 4인, 5인... 공제대상 가족 수에 따른 세액] }
const NTS_TAX_TABLE = [
  { min: 0, max: 1060000, taxes: [0, 0, 0, 0, 0, 0, 0] },
  { min: 1060000, max: 1100000, taxes: [1320, 0, 0, 0, 0, 0, 0] },
  { min: 1100000, max: 1200000, taxes: [3300, 0, 0, 0, 0, 0, 0] },
  { min: 1200000, max: 1300000, taxes: [6600, 0, 0, 0, 0, 0, 0] },
  { min: 1300000, max: 1400000, taxes: [9900, 0, 0, 0, 0, 0, 0] },
  { min: 1400000, max: 1500000, taxes: [13200, 0, 0, 0, 0, 0, 0] },
  { min: 1500000, max: 1600000, taxes: [16500, 0, 0, 0, 0, 0, 0] },
  { min: 1600000, max: 1700000, taxes: [19800, 0, 0, 0, 0, 0, 0] },
  { min: 1700000, max: 1800000, taxes: [23100, 0, 0, 0, 0, 0, 0] },
  { min: 1800000, max: 1900000, taxes: [26400, 0, 0, 0, 0, 0, 0] },
  { min: 1900000, max: 2000000, taxes: [29700, 0, 0, 0, 0, 0, 0] },
  { min: 2000000, max: 2100000, taxes: [15470, 0, 0, 0, 0, 0, 0] },
  { min: 2100000, max: 2200000, taxes: [18250, 0, 0, 0, 0, 0, 0] },
  { min: 2200000, max: 2300000, taxes: [25600, 11100, 0, 0, 0, 0, 0] },
  { min: 2300000, max: 2400000, taxes: [29160, 14660, 0, 0, 0, 0, 0] },
  { min: 2400000, max: 2500000, taxes: [36910, 22410, 10260, 0, 0, 0, 0] },
  { min: 2500000, max: 2600000, taxes: [42910, 28410, 16260, 0, 0, 0, 0] },
  { min: 2600000, max: 2700000, taxes: [50660, 36160, 24010, 0, 0, 0, 0] },
  { min: 2700000, max: 2800000, taxes: [58410, 43910, 31760, 12610, 0, 0, 0] },
  { min: 2800000, max: 2900000, taxes: [66160, 51660, 39510, 20360, 0, 0, 0] },
  { min: 2900000, max: 3000000, taxes: [73910, 59410, 47260, 28110, 0, 0, 0] },
  { min: 3000000, max: 3100000, taxes: [81660, 67160, 55010, 35860, 16710, 0, 0] }
];

// 3. 종합소득세 누진 기본세율표 (퇴직소득세 등 굵직한 세금 계산용)
const BASIC_TAX_TABLE = [
  { over: 1000000000, rate: 0.45, deduction: 65940000 },
  { over: 500000000,  rate: 0.42, deduction: 35940000 },
  { over: 300000000,  rate: 0.40, deduction: 25940000 },
  { over: 150000000,  rate: 0.38, deduction: 19940000 },
  { over: 88000000,   rate: 0.35, deduction: 15440000 },
  { over: 50000000,   rate: 0.24, deduction: 5760000 },
  { over: 14000000,   rate: 0.15, deduction: 1260000 },
  { over: 0,          rate: 0.06, deduction: 0 }
];

/**
 * [공통 함수] 과세표준(taxBase)을 받아 누진세율(6%~45%) 적용 산출세액 반환
 * - 퇴직금의 환산급여 과세표준 등에 주로 사용됩니다.
 */
function getBasicTax(taxBase) {
  if (taxBase <= 0) return 0;
  for (let bracket of BASIC_TAX_TABLE) {
    if (taxBase > bracket.over) {
      return (taxBase * bracket.rate) - bracket.deduction;
    }
  }
  return 0;
}

/**
 * ============================================================================
 * [핵심 로직] 국세청 홈택스 정밀 자동계산 공식 산식
 * 세액표 범위를 벗어나거나, 보다 정밀한 소득세 계산이 필요할 때 사용됩니다.
 * ============================================================================
 */
function calculateNtsFormulaTax(baseSalary, dependents = 1) {
  // Y = 연간 총급여액 (월급 × 12개월)
  const Y = baseSalary * 12;

  // E = 근로소득공제 (급여 구간별 공제율 다름)
  let E = 0;
  if (Y <= 5000000) E = Y * 0.7;
  else if (Y <= 15000000) E = 3500000 + (Y - 5000000) * 0.4;
  else if (Y <= 45000000) E = 7500000 + (Y - 15000000) * 0.15;
  else if (Y <= 100000000) E = 12000000 + (Y - 45000000) * 0.05;
  else E = 14750000 + (Y - 100000000) * 0.02;

  // I = 근로소득금액 (총급여액 Y - 근로소득공제 E)
  const I = Y - E;

  // P = 인적공제 (부양가족 1인당 150만 원 공제)
  const P = dependents * 1500000;

  // N = 연금보험료공제 (국민연금 상/하한선 적용 후 4.5% 기준 1년 치 반영)
  const pensionBase = Math.max(RATES_CONFIG.NP.MIN_BASE, Math.min(baseSalary, RATES_CONFIG.NP.MAX_BASE));
  const N = Math.floor(pensionBase * 0.045) * 12; // 국세청 간이세액표는 4.5%를 기준으로 계산함

  // S = 특별소득공제 (가족 수 및 총급여 구간에 따른 기초 공제)
  let S = 0;
  if (dependents === 1) { // 1인 가구 특별소득공제
    if (Y <= 30000000) S = 3100000 + (Y * 0.04);
    else if (Y <= 45000000) S = 3100000 + (Y * 0.04) - ((Y - 30000000) * 0.05);
    else if (Y <= 70000000) S = 3100000 + (Y * 0.015);
    else if (Y <= 120000000) S = 3100000 + (Y * 0.005);
    else S = 3100000;
  } else { // 2인 이상 가구 특별소득공제
    if (Y <= 30000000) S = 3600000 + (Y * 0.04);
    else if (Y <= 45000000) S = 3600000 + (Y * 0.04) - ((Y - 30000000) * 0.05);
    else if (Y <= 70000000) S = 3600000 + (Y * 0.02);
    else if (Y <= 120000000) S = 3600000 + (Y * 0.01);
    else S = 3600000;
  }

  // 과세표준 (Tax Base) = 근로소득금액(I) - 인적공제(P) - 연금(N) - 특별공제(S)
  const taxBase = Math.max(0, I - P - N - S);

  // 산출세액(calcTax) 계산: 기본 누진세율표 적용 (getBasicTax 함수 재활용)
  let calcTax = getBasicTax(taxBase);

  // 근로소득 세액공제 (산출세액에 따라 공제율 및 한도 적용)
  let taxCredit = calcTax <= 500000 ? calcTax * 0.55 : 275000 + (calcTax - 500000) * 0.30;
  let taxCreditLimit = Y <= 33000000 ? 740000 : Math.max(660000, 740000 - (Y - 33000000) * 0.008);
  taxCredit = Math.min(taxCredit, taxCreditLimit);

  // 결정세액 = 산출세액 - 세액공제
  const finalTax = Math.max(0, calcTax - taxCredit);
  
  // 연간 세액을 12개월로 나누고, 원천징수 규정에 따라 10원 미만 절사하여 최종 월 소득세 반환
  return Math.floor(finalTax / 12 / 10) * 10;
}

/**
 * ============================================================================
 * 💡 [통합 대표 함수] 외부에서 호출하는 소득세 산출 마스터 함수
 * - 사용법: const incomeTax = getIncomeTax(3000000, 1);
 * ============================================================================
 */
function getIncomeTax(taxableSalary, dependents = 1) {
  // 106만 원 이하는 무조건 면세 (소득세 0원)
  if (taxableSalary <= 1060000) return 0;

  // 1. 간이세액표 배열에 매칭되는 구간이 있는지 찾기
  const row = NTS_TAX_TABLE.find(item => taxableSalary >= item.min && taxableSalary < item.max);
  if (row) {
    // 공제대상 가족 수(최대 11명)에 맞는 배열 인덱스 찾기
    const depIdx = Math.max(1, Math.min(dependents, 11)) - 1;
    // 해당 가족 수 데이터가 있으면 반환, 없으면 배열의 마지막(최대치) 값 반환
    return row.taxes[depIdx] !== undefined ? row.taxes[depIdx] : row.taxes[row.taxes.length - 1];
  }

  // 2. 간이세액표에 없는 높은 금액 구간은 국세청 정밀 산식으로 100% 자동 연산하여 반환
  return calculateNtsFormulaTax(taxableSalary, dependents);
}