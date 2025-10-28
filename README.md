# Paper Network

논문 인용 네트워크를 시각화하는 웹 애플리케이션입니다. Connected Papers와 유사한 기능을 제공합니다.

## 주요 기능

- **논문 검색**: Semantic Scholar API를 통한 2억+ 논문 검색
- **네트워크 시각화**: Cytoscape.js를 활용한 인터랙티브 그래프
- **인용 관계**: 논문 간 인용/참조 관계를 시각적으로 표현
- **상세 정보**: 논문의 저자, 연도, 초록 등 상세 정보 제공

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **시각화**: Cytoscape.js
- **상태 관리**: TanStack React Query
- **스타일링**: Tailwind CSS
- **API**: Semantic Scholar Graph API

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

### 빌드

```bash
npm run build
npm start
```

## 사용 방법

1. 검색창에 논문 제목이나 키워드를 입력합니다
2. 검색 결과에서 원하는 논문을 선택합니다
3. 선택한 논문을 중심으로 인용 네트워크가 시각화됩니다
4. 노드를 클릭하여 연결된 논문의 상세 정보를 확인합니다
5. 확대/축소 및 드래그로 네트워크를 탐색합니다

## 성능 최적화

- **점진적 로딩**: 1차 인용 관계만 먼저 로드
- **캐싱**: React Query를 통한 자동 캐싱
- **효율적 렌더링**: Cytoscape.js의 최적화된 그래프 렌더링

## 라이선스

MIT
