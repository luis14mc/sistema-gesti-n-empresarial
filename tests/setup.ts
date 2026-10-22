import '@testing-library/jest-dom';

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sge_test',
  JWT_SECRET: 'test-secret-key-for-vitest-only-00000000',
  STORAGE_DRIVER: 'local',
  COOKIE_SECURE: 'false',
});
