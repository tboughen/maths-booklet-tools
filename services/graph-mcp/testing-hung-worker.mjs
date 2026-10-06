// Test-only worker. Docker runtime copies only compiled service files.
process.once("message", () => setInterval(() => {}, 1000));
