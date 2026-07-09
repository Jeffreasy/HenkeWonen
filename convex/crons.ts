import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every night at 03:00 to clean up import logs older than 7 days
crons.daily(
  "clean up old import logs",
  { hourUTC: 3, minuteUTC: 0 },
  internal.catalog.v2_import.cleanupOldLogsCron
);

export default crons;
