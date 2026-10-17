// ═══════════════════════════════════════════════════════════════
// Beis — מערכת הודעות (Toast Notifications)
// ═══════════════════════════════════════════════════════════════

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
  link?: { label: string; href: string };
}

class ToastStore {
  toasts = $state<Toast[]>([]);
  private counter = 0;

  private add(message: string, type: Toast['type'], duration: number, link?: Toast['link']): void {
    const id = `toast-${++this.counter}`;
    this.toasts = [...this.toasts, { id, message, type, duration, link }];
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string, link?: Toast['link'], duration = 3000): void {
    this.add(message, 'success', duration, link);
  }

  error(message: string, duration = 5000): void {
    this.add(message, 'error', duration);
  }

  info(message: string, duration = 3000): void {
    this.add(message, 'info', duration);
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}

export const toast = new ToastStore();
