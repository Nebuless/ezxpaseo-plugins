export function isRecursiveDeletion(command: string): boolean {
  return /\brm\s+-rf\b/.test(command);
}

export function requestsSingleFollowUp(text: string): boolean {
  return text.includes("[retry-once]");
}
