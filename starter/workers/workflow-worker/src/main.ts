import { getPool } from "@semester/database/client";
import { runOnce } from "./queue";

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});

async function main(): Promise<void> {
  try {
    while (!stopping) {
      const didWork = await runOnce();
      if (!didWork) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    // Idle pool connections keep the process alive, so close them on the way out.
    await getPool().end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
