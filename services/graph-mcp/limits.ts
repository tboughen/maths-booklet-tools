import { GraphError } from "../../packages/graph-core/src/interchange";
export class TrafficLimits {
  private window = 0;
  private calls = 0;
  private clients = new Map<string, number>();
  private day = "";
  private bytes = 0;
  constructor(private maximumDailyBytes = 200 * 1024 * 1024) {}
  request(client: string, now = Date.now()): void {
    const window = Math.floor(now / 60_000);
    if (window !== this.window) {
      this.window = window;
      this.calls = 0;
      this.clients.clear();
    }
    const count = this.clients.get(client) ?? 0;
    if (this.calls >= 120 || count >= 40)
      throw new GraphError(
        "rate_limited",
        "Too many requests. Try again in a minute.",
      );
    this.calls++;
    this.clients.set(client, count + 1);
  }
  output(size: number, now = Date.now()): void {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.bytes = 0;
    }
    if (this.bytes + size > this.maximumDailyBytes)
      throw new GraphError(
        "rate_limited",
        "Today's download allowance has been reached.",
      );
    this.bytes += size;
  }
}
