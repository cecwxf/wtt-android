// Shared across WebView remounts: the OS launch URL is not the latest navigation.
export class LaunchLink {
  private consumed = false;
  private revision = 0;

  observeNavigation() {
    this.revision++;
  }

  async readInitial(read: () => Promise<string | null>, routeUrl: string | null) {
    if (this.consumed) return null;
    this.consumed = true;
    if (routeUrl) return null;
    const revision = this.revision;
    const url = await read();
    return revision === this.revision ? url : null;
  }
}
