export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "upper", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "number", label: "One number", test: (v: string) => /\d/.test(v) },
  { id: "special", label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export function isPasswordStrong(v: string) {
  return PASSWORD_RULES.every((r) => r.test(v));
}
