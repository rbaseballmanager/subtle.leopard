# The Subtle Leopard - One Precise Strike

GitHub Pages에서 실행할 수 있는 정적 주식 분석 웹페이지입니다. 사용자가 종목코드를 입력하면 회사 고유번호를 찾고, 최근 5개 사업연도의 분기별 재무 데이터를 표와 Chart.js 콤보 차트로 표시합니다.

## 파일 구성

```text
/
├─ index.html
├─ style.css
├─ script.js
├─ leopard.jpg
└─ README.md
```

## OpenDART API Key 설정

OpenDART API Key는 프론트엔드 코드에 넣지 않습니다. GitHub Pages에서는 Cloudflare Worker Secret에 저장하고, Worker가 OpenDART 요청에 `crtfc_key`를 붙입니다.

`script.js`에는 배포한 Worker 주소만 넣습니다.

```js
const OPEN_DART_PROXY_URL = "https://opendart-proxy.buttea.workers.dev/?url=";
```

로컬 테스트에서는 별도 터미널에서 아래 명령을 실행하면 웹페이지가 자동으로 `http://localhost:8787` 프록시를 사용합니다. PowerShell 예시:

```powershell
$env:OPEN_DART_API_KEY="발급받은_API_KEY"
node local-proxy.js
```

## GitHub Pages 배포 방법

1. 이 프로젝트 파일을 GitHub 저장소 루트에 커밋합니다.
2. GitHub 저장소의 `Settings` 메뉴로 이동합니다.
3. `Pages`에서 배포 소스를 `Deploy from a branch`로 선택합니다.
4. 브랜치는 `main` 또는 사용하는 기본 브랜치를 선택하고, 폴더는 `/root`를 선택합니다.
5. 저장 후 표시되는 GitHub Pages 주소로 접속합니다.

## API Key 노출 주의사항

GitHub Pages에 배포된 프론트엔드 코드는 누구나 볼 수 있습니다. API Key를 `index.html`이나 `script.js`에 직접 넣으면 외부에 노출됩니다. 운영 시에는 Cloudflare Worker Secret 같은 서버 측 저장소에 보관해야 합니다.

## 주요 기능

- 종목코드로 OpenDART 회사 고유번호 조회
- 최근 5개 연도, 1Q/2Q/3Q/4Q 재무 데이터 조회
- 반기, 3분기, 사업보고서 누적값을 분기값으로 환산
- 매출액, 영업이익, 지배주주순이익 표시
- 매출액 YoY, 영업이익 YoY 계산
- 재무제표 가로 스크롤 표
- 영업이익 막대그래프와 매출액/지배주주순이익 꺾은선 콤보 차트

## 향후 개선 방향

- Cloudflare Worker로 API Key 숨기기
- 주가 차트 추가
- 여러 종목 비교 기능
- 즐겨찾기 기능
- PER, PBR, ROE 추가
