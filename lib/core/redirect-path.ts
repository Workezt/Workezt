/** Only relative paths on this application are valid post-login destinations. */
export function safeRedirectPath(value: string, fallback = "/") {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
