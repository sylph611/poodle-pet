/**
 * 민감한 클립보드 내용 감지 heuristic.
 * 완벽한 분류 X, false negative 허용. 비번·카드·2FA·토큰 등 명백한 패턴만.
 * 유저가 민감 작업 중일 땐 "일시정지" 사용.
 */
export function isSensitive(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // 카드번호: 공백/하이픈 제거 후 13~19자리 숫자
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (/^\d{13,19}$/.test(digitsOnly)) return true;

  // 2FA: 정확히 6자리 숫자
  if (/^\d{6}$/.test(trimmed)) return true;

  // base64 토큰: 숫자+영문+/+= 40자 이상 (숫자 1개 이상 있어야 → 일반 영문 단어 배제)
  if (trimmed.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(trimmed) && /\d/.test(trimmed)) return true;

  // 비밀번호 heuristic: 공백 없음 + 대·소·숫자·특수 10자+
  if (/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_])\S{10,}$/.test(trimmed)) return true;

  return false;
}
