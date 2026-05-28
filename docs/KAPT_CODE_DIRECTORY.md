# K-apt 코드 디렉터리

## 결론

공식적으로 확인한 K-apt 단지 코드 원천은 공공데이터포털의 `국토교통부_공동주택 단지 목록제공 서비스` API입니다. 별도 CSV/엑셀 다운로드 파일을 정기 배포하는 공식 경로는 확인하지 못했습니다.

그래서 앱은 `kapt_code_directory` 테이블을 검색 캐시로 사용합니다. `아파트 종합 정보 조회하기`를 실행하면 먼저 이 테이블에서 후보를 찾고, 없거나 확신이 낮으면 K-apt 목록 API를 조회한 뒤 결과를 테이블에 저장합니다.

## Supabase 적용

새 migration:

```text
supabase/migrations/20260521000100_kapt_code_directory.sql
```

운영 Supabase에는 이 migration이 적용되어 있습니다. 적용 전 환경에서는 앱이 외부 API fallback으로 동작하지만, 캐시는 저장되지 않습니다.

## 자동 캐시 흐름

1. `POST /api/apartments/:id/kapt-code/resolve`
2. `kapt_code_directory`에서 `bjd_code` exact, 시군구 prefix 순서로 후보 조회
3. 후보가 없거나 자동 확정이 어렵다면 K-apt 목록 API 조회
4. 조회 결과를 `kapt_code_directory`에 upsert
5. 후보가 명확하면 `apartments.kapt_code` 저장, 애매하면 후보 선택 UI 반환

사용 API 우선순위:

```text
getLegaldongAptList3 / legacy getLegaldongAptList
getSigunguAptList3 / legacy getSigunguAptList
getSidoAptList3 / legacy getSidoAptList
```

## 대량 적재

운영 DB를 직접 채우려면 로컬 또는 CI 환경에 아래 env가 있어야 합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
KAPT_API_KEY
```

지역 단위 적재:

```bash
npm run sync:kapt-directory -- --sigungu 11560
npm run sync:kapt-directory -- --bjd 1156013200
npm run sync:kapt-directory -- --sido 11
```

현재 운영 DB에는 서울 전체 캐시를 먼저 적재했습니다. 2026-05-29 기준 `kapt_code_directory` 3,372건을 확인했습니다.

```bash
npm run sync:kapt-directory -- --sido 11 # 서울특별시
```

추가 지역이 필요하면 같은 스크립트로 2자리 시도 코드, 5자리 시군구 코드, 10자리 법정동 코드를 넣어 적재하면 됩니다. 앱의 admin 조회 요청도 후보가 없는 지역은 외부 K-apt 목록 API를 조회한 뒤 같은 테이블에 캐시합니다.
