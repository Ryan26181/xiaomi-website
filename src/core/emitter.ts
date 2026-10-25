/** A store others can watch: views re-render when it changes. */
export class Emitter {
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected changed() {
    for (const fn of this.listeners) fn();
  }
}
