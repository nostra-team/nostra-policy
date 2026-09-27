/**
 * 방침·약관 한 판의 모양 — 앱 레포 `shared/legal/<문서>/<시행일>[.en].json` 과 같다
 * (앱의 `LegalBlock`). 빌드 스크립트와 비교 화면이 함께 쓰는 전역 선언이라 import 없이 보인다.
 */

interface LegalItem {
  readonly title: string;
  readonly lines: readonly string[];
}

interface LegalBlock {
  readonly heading?: string;
  readonly body?: readonly string[];
  readonly bullets?: readonly string[];
  readonly items?: readonly LegalItem[];
}

type LegalDoc = 'privacy' | 'terms';
type VersionStatus = 'current' | 'upcoming' | 'past';

/** data/index.json — 비교 화면의 판 목록 (새 판이 앞) */
type LegalListing = Record<LegalDoc, { date: string; status: VersionStatus }[]>;
