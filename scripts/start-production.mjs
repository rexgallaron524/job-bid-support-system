// Native Windows/local startup. Docker starts server.js with its own private-network host.
process.env.HOSTNAME = "127.0.0.1";
process.env.NEXT_TELEMETRY_DISABLED = "1";
await import("../.next/standalone/server.js");
