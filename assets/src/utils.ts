export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number,
): T {
  let timer = 0;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs) as any;
  }) as T;
}

export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
