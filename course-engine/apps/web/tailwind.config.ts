import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#0b0d10", panel: "#12151a", gold: "#d5b574" } } }, plugins: [] } satisfies Config;
