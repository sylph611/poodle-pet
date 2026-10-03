import { describe, it, expect } from "vitest";
import { isSensitive } from "../../src/main/sensitive-detector";

describe("isSensitive — 카드번호", () => {
  it("13자리 숫자 → true", () => {
    expect(isSensitive("1234567890123")).toBe(true);
  });
  it("16자리 숫자 → true", () => {
    expect(isSensitive("1234567890123456")).toBe(true);
  });
  it("19자리 숫자 → true", () => {
    expect(isSensitive("1234567890123456789")).toBe(true);
  });
  it("공백/하이픈 포함된 카드번호도 감지", () => {
    expect(isSensitive("1234 5678 9012 3456")).toBe(true);
    expect(isSensitive("1234-5678-9012-3456")).toBe(true);
  });
  it("12자리는 false (전화번호 등)", () => {
    expect(isSensitive("123456789012")).toBe(false);
  });
});

describe("isSensitive — 2FA (6자리 숫자)", () => {
  it("정확히 6자리 숫자 → true", () => {
    expect(isSensitive("123456")).toBe(true);
    expect(isSensitive("000000")).toBe(true);
  });
  it("5자리 또는 7자리는 false", () => {
    expect(isSensitive("12345")).toBe(false);
    expect(isSensitive("1234567")).toBe(false);
  });
});

describe("isSensitive — base64 토큰", () => {
  it("숫자 포함 40자+ base64 → true", () => {
    expect(isSensitive("abcdef1234567890ABCDEFghijklmnopqrstuvwxyz")).toBe(true);
  });
  it("숫자 없는 긴 영문은 false (일반 문장)", () => {
    expect(isSensitive("thisisnotatokenbutalongenglishwordstring")).toBe(false);
  });
  it("40자 미만은 false", () => {
    expect(isSensitive("abc123def456")).toBe(false);
  });
});

describe("isSensitive — 비밀번호 heuristic", () => {
  it("대·소·숫자·특수 10자 이상 → true", () => {
    expect(isSensitive("Abcd1234!@")).toBe(true);
    expect(isSensitive("MyPass123!xyz")).toBe(true);
  });
  it("공백 포함은 false (문장일 가능성)", () => {
    expect(isSensitive("Hello world 123!")).toBe(false);
  });
  it("특수문자 없으면 false", () => {
    expect(isSensitive("Abcd12345678")).toBe(false);
  });
});

describe("isSensitive — 일반 텍스트는 false", () => {
  it("URL", () => {
    expect(isSensitive("https://github.com/sylph611/poodle-pet")).toBe(false);
  });
  it("코드 조각", () => {
    expect(isSensitive("const foo = bar();")).toBe(false);
  });
  it("한글 메모", () => {
    expect(isSensitive("오후 3시 회의 참석")).toBe(false);
  });
});
