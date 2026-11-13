import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two suites with genuinely different needs, so they are configured as
// separate projects rather than bent into one shape.
//
//   server — Express, Mongoose, real HTTP requests. Needs a database and the
//            node environment, and its files must not run in parallel because
//            they share one test database.
//   ui     — React components. Needs a browser-like environment and the JSX
//            transform, and must NOT need a database: a render test that only
//            runs when MongoDB happens to be up is a render test nobody runs.
export default defineConfig({
  test: {
    globals: true,
    // Root level, not just inside the server project: with projects, files
    // otherwise run in parallel *across* them too, and the server suite shares
    // a single test database that each file wipes between tests. Two files
    // running at once means one clearing the other's fixtures mid-run, which
    // surfaces as unrelated sign-in failures rather than anything true.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.js'],
          setupFiles: ['tests/setup.js'],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 30000
        }
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          globals: true,
          environment: 'jsdom',
          include: ['tests/ui/**/*.test.jsx'],
          setupFiles: ['tests/ui/setup.js'],
          testTimeout: 15000
        }
      }
    ]
  }
});
