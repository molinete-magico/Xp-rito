/** Une classes sem dependência externa. Suficiente para este projeto. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
