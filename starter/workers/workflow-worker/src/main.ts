import { runOnce } from "./queue";

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});

async function main(): Promise<void> {
  while (!stopping) {
    const didWork = await runOnce();
    if (!didWork) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
