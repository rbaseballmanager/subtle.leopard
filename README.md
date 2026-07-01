# The Subtle Leopard - One Precise Strike

GitHub Pages에서 실행할 수 있는 정적 주식 분석 웹페이지입니다. 사용자가 종목코드와 OpenDART API Key를 입력하면 회사 고유번호를 찾고, 최근 5개 사업연도의 분기별 재무 데이터를 표와 Chart.js 콤보 차트로 표시합니다.

## 파일 구성

```text
/
├─ index.html
├─ style.css
├─ script.js
├─ leopard.jpg
└─ README.md
```

## OpenDART API Key 입력 위치

테스트할 때는 웹페이지 상단의 `OpenDART API Key` 입력칸에 API Key를 넣고 조회하면 됩니다.

코드에 직접 넣고 싶다면 `script.js` 상단의 값을 수정합니다.

```js
const OPEN_DART_API_KEY = "여기에_API_KEY_입력";
```

브라우저에서 OpenDART 호출이 CORS 정책으로 막히는 경우에는 `script.js`의 `OPEN_DART_PROXY_URL`에 본인 소유의 Cloudflare Worker 또는 서버 프록시 주소를 넣어 사용합니다. 제3자 공개 프록시는 API Key가 노출될 수 있으므로 권장하지 않습니다.

로컬 테스트에서는 별도 터미널에서 아래 명령을 실행하면 웹페이지가 자동으로 `http://localhost:8787` 프록시를 사용합니다.

```powershell
node local-proxy.js
```

## GitHub Pages 배포 방법

1. 이 프로젝트 파일을 GitHub 저장소 루트에 커밋합니다.
2. GitHub 저장소의 `Settings` 메뉴로 이동합니다.
3. `Pages`에서 배포 소스를 `Deploy from a branch`로 선택합니다.
4. 브랜치는 `main` 또는 사용하는 기본 브랜치를 선택하고, 폴더는 `/root`를 선택합니다.
5. 저장 후 표시되는 GitHub Pages 주소로 접속합니다.

## API Key 노출 주의사항

현재 구현은 테스트 편의를 위해 프론트엔드에서 OpenDART API Key를 입력하거나 코드에 직접 넣을 수 있습니다. GitHub Pages에 배포하면 브라우저 코드가 그대로 공개되므로 API Key가 외부에 노출됩니다.

실제 운영 시에는 API Key를 프론트엔드에 두지 말고 서버 측에서 보호해야 합니다.

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
