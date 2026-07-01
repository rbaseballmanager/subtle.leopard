// OpenDART API Key는 프론트엔드에 두지 않는다.
// Cloudflare Worker Secret에 저장하고 Worker가 OpenDART 요청에 crtfc_key를 붙인다.
const OPEN_DART_PROXY_URL = "https://opendart-proxy.xxxxx.workers.dev/?url=";
const LOCAL_OPEN_DART_PROXY_URL = "http://localhost:8787/?url=";

const REPORTS = [
  { quarter: "1Q", code: "11013", cumulativeBase: null },
  { quarter: "2Q", code: "11012", cumulativeBase: "1Q" },
  { quarter: "3Q", code: "11014", cumulativeBase: "2Q" },
  { quarter: "4Q", code: "11011", cumulativeBase: "3Q" },
];

const ACCOUNT_ALIASES = {
  revenue: {
    names: ["매출액", "수익(매출액)", "영업수익", "매출", "Revenue"],
    ids: ["ifrs-full_Revenue", "ifrs_Revenue"],
  },
  operatingIncome: {
    names: ["영업이익", "영업이익(손실)", "Operating income", "Profit from operations"],
    ids: ["dart_OperatingIncomeLoss", "ifrs-full_ProfitLossFromOperatingActivities"],
  },
  controllingNetIncome: {
    names: [
      "지배기업의 소유주에게 귀속되는 당기순이익",
      "지배기업 소유주지분 순이익",
      "지배기업소유주지분순이익",
      "지배기업의 소유주지분에 귀속되는 당기순이익",
      "당기순이익",
      "당기순이익(손실)",
    ],
    ids: ["ifrs-full_ProfitLossAttributableToOwnersOfParent", "ifrs_ProfitLossAttributableToOwnersOfParent"],
  },
};

const state = {
  corpList: null,
  chart: null,
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.form = document.querySelector("#searchForm");
  els.stockCodeInput = document.querySelector("#stockCodeInput");
  els.fsModeInput = document.querySelector("#fsModeInput");
  els.companyName = document.querySelector("#companyName");
  els.companyCode = document.querySelector("#companyCode");
  els.statusText = document.querySelector("#statusText");
  els.table = document.querySelector("#financialTable");
  els.chartCanvas = document.querySelector("#financialChart");

  renderEmptyTable(buildPeriods());
  renderChart(buildPeriods(), []);

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleSearch();
  });
});

async function handleSearch() {
  const stockCode = normalizeStockCode(els.stockCodeInput.value);
  const fsMode = els.fsModeInput.value;

  if (!stockCode) {
    setStatus("종목코드가 비어 있습니다. 6자리 종목코드를 입력하세요.", true);
    els.stockCodeInput.focus();
    return;
  }

  setLoading(true);
  setStatus("회사 고유번호를 조회하고 있습니다...");

  try {
    const corpList = await getCorpList();
    const company = corpList.find((corp) => corp.stockCode === stockCode);

    if (!company) {
      throw new UserFacingError("종목코드에 해당하는 회사 정보를 찾을 수 없습니다.");
    }

    els.companyName.textContent = company.name;
    els.companyCode.textContent = stockCode;
    setStatus(`${company.name} 재무제표를 조회하고 있습니다...`);

    const periods = buildPeriods();
    const rowsByPeriod = await fetchFinancialRows(company.corpCode, periods, fsMode);
    const data = buildQuarterlyFinancials(periods, rowsByPeriod);
    const missing = data.filter((item) => item.missing).length;

    renderFinancialTable(data);
    renderChart(periods, data);

    if (data.every((item) => item.missing)) {
      throw new UserFacingError("재무제표 데이터가 없습니다. API Key, 종목코드, 보고서 제출 여부를 확인하세요.");
    }

    setStatus(missing > 0 ? `조회 완료. 일부 분기 데이터 ${missing}개가 누락되었습니다.` : "조회 완료.");
  } catch (error) {
    console.error(error);
    const message =
      error instanceof UserFacingError
        ? error.message
        : "OpenDART API 호출에 실패했습니다. 브라우저 CORS 정책에 막히면 본인 소유 프록시를 사용하세요.";
    setStatus(message, true);
  } finally {
    setLoading(false);
  }
}

function normalizeStockCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length ? digits.padStart(6, "0").slice(-6) : "";
}

function buildPeriods() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 4 + index);
  return years.flatMap((year) => REPORTS.map((report) => ({ year, quarter: report.quarter, reportCode: report.code })));
}

async function getCorpList(apiKey) {
  if (state.corpList) {
    return state.corpList;
  }

  const arrayBuffer = await fetchArrayBuffer("https://opendart.fss.or.kr/api/corpCode.xml");
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = zip.file("CORPCODE.xml") || zip.file("corpCode.xml") || Object.values(zip.files)[0];

  if (!xmlFile) {
    throw new UserFacingError("회사 고유번호 파일을 읽을 수 없습니다.");
  }

  const xmlText = await xmlFile.async("text");
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = doc.querySelector("parsererror");

  if (parseError) {
    throw new UserFacingError("회사 고유번호 XML 파싱에 실패했습니다.");
  }

  state.corpList = [...doc.querySelectorAll("list")]
    .map((node) => ({
      corpCode: node.querySelector("corp_code")?.textContent?.trim() || "",
      name: node.querySelector("corp_name")?.textContent?.trim() || "",
      stockCode: node.querySelector("stock_code")?.textContent?.trim() || "",
    }))
    .filter((corp) => corp.corpCode && corp.stockCode);

  return state.corpList;
}

async function fetchFinancialRows(corpCode, periods, fsMode) {
  const rowsByPeriod = new Map();

  for (const period of periods) {
    const rows =
      fsMode === "AUTO"
        ? [
            ...(await fetchSingleFinancialReport(corpCode, period, "CFS")),
            ...(await fetchSingleFinancialReport(corpCode, period, "OFS")),
          ]
        : await fetchSingleFinancialReport(corpCode, period, fsMode);
    rowsByPeriod.set(periodKey(period), rows);
  }

  return rowsByPeriod;
}

async function fetchSingleFinancialReport(corpCode, period, fsDiv) {
  const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(period.year));
  url.searchParams.set("reprt_code", period.reportCode);
  url.searchParams.set("fs_div", fsDiv);

  const data = await fetchJson(url.toString());

  if (data.status === "013") {
    return [];
  }

  if (data.status !== "000") {
    return [];
  }

  return Array.isArray(data.list) ? data.list : [];
}

function buildQuarterlyFinancials(periods, rowsByPeriod) {
  const cumulativeByKey = new Map();

  for (const period of periods) {
    const rows = rowsByPeriod.get(periodKey(period)) || [];
    cumulativeByKey.set(periodKey(period), {
      revenue: pickAccountValue(rows, ACCOUNT_ALIASES.revenue),
      operatingIncome: pickAccountValue(rows, ACCOUNT_ALIASES.operatingIncome),
      controllingNetIncome: pickAccountValue(rows, ACCOUNT_ALIASES.controllingNetIncome),
    });
  }

  const data = periods.map((period) => {
    const cumulative = cumulativeByKey.get(periodKey(period));
    const reportMeta = REPORTS.find((report) => report.quarter === period.quarter);
    const previousPeriod =
      reportMeta.cumulativeBase && periods.find((candidate) => candidate.year === period.year && candidate.quarter === reportMeta.cumulativeBase);
    const previousCumulative = previousPeriod ? cumulativeByKey.get(periodKey(previousPeriod)) : null;
    const values = {};

    for (const key of Object.keys(ACCOUNT_ALIASES)) {
      values[key] = toQuarterValue(cumulative?.[key], previousCumulative?.[key]);
    }

    return {
      ...period,
      label: `${period.year}.${period.quarter}`,
      ...values,
      missing: Object.values(values).every((value) => value === null),
    };
  });

  return data.map((item, index) => {
    const previousYearSameQuarter = data.find((candidate) => candidate.year === item.year - 1 && candidate.quarter === item.quarter);
    return {
      ...item,
      revenueYoy: calcYoy(item.revenue, previousYearSameQuarter?.revenue),
      operatingIncomeYoy: calcYoy(item.operatingIncome, previousYearSameQuarter?.operatingIncome),
    };
  });
}

function pickAccountValue(rows, matcher) {
  const statementRows = rows.filter((item) => ["IS", "CIS"].includes(item.sj_div));
  const searchRows = statementRows.length ? statementRows : rows;
  const normalizedNames = matcher.names.map(normalizeAccountName);
  const normalizedIds = matcher.ids.map(normalizeAccountId);
  const candidates = searchRows.filter(
    (item) =>
      normalizedNames.includes(normalizeAccountName(item.account_nm)) ||
      normalizedIds.includes(normalizeAccountId(item.account_id)),
  );
  const row = candidates.find((item) => parseFinancialAmount(item) !== null);
  return row ? parseFinancialAmount(row) : null;
}

function normalizeAccountName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[（）]/g, (match) => (match === "（" ? "(" : ")"))
    .toLowerCase();
}

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase();
}

function parseFinancialAmount(row) {
  return parseAmount(row.thstrm_add_amount) ?? parseAmount(row.thstrm_amount);
}

function parseAmount(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") {
    return null;
  }

  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const number = Number(cleaned.replace(/[()]/g, ""));
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}

function toQuarterValue(current, previous) {
  if (current === null || current === undefined) {
    return null;
  }

  if (previous === null || previous === undefined) {
    return current;
  }

  const value = current - previous;
  const likelyInvalid = current >= 0 && previous >= 0 && value < 0;
  return likelyInvalid ? current : value;
}

function calcYoy(current, previous) {
  if (current === null || current === undefined || !previous) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchJson(url) {
  const response = await fetchOpenDart(url);
  return response.json();
}

async function fetchArrayBuffer(url) {
  const response = await fetchOpenDart(url);
  return response.arrayBuffer();
}

async function fetchOpenDart(url) {
  const proxyUrl = getOpenDartProxyUrl();
  const targetUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
  const response = await fetch(targetUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response;
}

function getOpenDartProxyUrl() {
  if (OPEN_DART_PROXY_URL) {
    return OPEN_DART_PROXY_URL;
  }

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return LOCAL_OPEN_DART_PROXY_URL;
  }

  return "";
}

function renderFinancialTable(data) {
  const headRow = els.table.querySelector("thead tr");
  const bodyRows = els.table.querySelectorAll("tbody tr");
  headRow.innerHTML = "<th>항목</th>";

  data.forEach((item) => {
    headRow.insertAdjacentHTML("beforeend", `<th>${item.label}</th>`);
  });

  const rows = [
    data.map((item) => formatMoney(item.revenue)),
    data.map((item) => formatPercent(item.revenueYoy)),
    data.map((item) => formatMoney(item.operatingIncome)),
    data.map((item) => formatPercent(item.operatingIncomeYoy)),
    data.map((item) => formatMoney(item.controllingNetIncome)),
  ];

  rows.forEach((values, rowIndex) => {
    const label = bodyRows[rowIndex].querySelector("th").outerHTML;
    bodyRows[rowIndex].innerHTML = label;
    values.forEach((value) => {
      const className = value === "-" ? " class=\"missing\"" : getValueClass(value);
      bodyRows[rowIndex].insertAdjacentHTML("beforeend", `<td${className}>${value}</td>`);
    });
  });
}

function renderEmptyTable(periods) {
  const emptyData = periods.map((period) => ({ ...period, label: `${period.year}.${period.quarter}` }));
  renderFinancialTable(
    emptyData.map((item) => ({
      ...item,
      revenue: null,
      revenueYoy: null,
      operatingIncome: null,
      operatingIncomeYoy: null,
      controllingNetIncome: null,
    })),
  );
}

function renderChart(periods, data) {
  const labels = data.length ? data.map((item) => item.label) : periods.map((item) => `${item.year}.${item.quarter}`);
  const chartData = data.length ? data : labels.map(() => ({}));

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(els.chartCanvas, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "영업이익",
          data: chartData.map((item) => toHundredMillionWon(item.operatingIncome)),
          backgroundColor: "rgba(31, 114, 216, 0.55)",
          borderColor: "#1f72d8",
          borderWidth: 1,
        },
        {
          type: "line",
          label: "매출액",
          data: chartData.map((item) => toHundredMillionWon(item.revenue)),
          borderColor: "#e03a2f",
          backgroundColor: "#e03a2f",
          pointRadius: 3,
          tension: 0.22,
        },
        {
          type: "line",
          label: "지배주주순이익",
          data: chartData.map((item) => toHundredMillionWon(item.controllingNetIncome)),
          borderColor: "#2f9b57",
          backgroundColor: "#2f9b57",
          pointRadius: 3,
          tension: 0.22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} 억원`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "#e5e7eb",
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          grid: {
            color: "#d1d5db",
          },
          ticks: {
            callback: (value) => formatNumber(value),
          },
        },
      },
    },
  });
}

function periodKey(period) {
  return `${period.year}-${period.quarter}`;
}

function toHundredMillionWon(value) {
  return value === null || value === undefined ? null : Math.round(value / 100000000);
}

function formatMoney(value) {
  return value === null || value === undefined ? "-" : formatNumber(toHundredMillionWon(value));
}

function formatPercent(value) {
  return value === null || value === undefined ? "-" : `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(1)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function getValueClass(value) {
  if (String(value).startsWith("-")) {
    return " class=\"negative\"";
  }

  if (String(value).endsWith("%") && !String(value).startsWith("-")) {
    return " class=\"positive\"";
  }

  return "";
}

function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.style.color = isError ? "#b91c1c" : "#5f6875";
}

function setLoading(isLoading) {
  const button = els.form.querySelector("button");
  button.disabled = isLoading;
  button.textContent = isLoading ? "조회중" : "조회";
}

class UserFacingError extends Error {}
