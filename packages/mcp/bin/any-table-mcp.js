#!/usr/bin/env node
import { startAnyTableServer } from '../dist/server.js';

startAnyTableServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[any-table-mcp] failed to start:', err);
  process.exit(1);
});
