export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runPreflight } = await import("./lib/preflight");
    await runPreflight();
  }
}
