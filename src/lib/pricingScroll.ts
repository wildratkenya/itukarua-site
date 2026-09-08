let pendingTarget: string | null = null;

export function setPendingScrollTarget(id: string): void {
  pendingTarget = id;
}

export function getPendingScrollTarget(): string | null {
  return pendingTarget;
}

export function clearPendingScrollTarget(): void {
  pendingTarget = null;
}