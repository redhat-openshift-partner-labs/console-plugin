import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  testRegex: '.*\\.spec\\.(ts|tsx|js|jsx)$',
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
    '<rootDir>/__mocks__/fileMock.ts',
    '\\.css$': '<rootDir>/__mocks__/styleMock.ts',
  },
  transform: {
    '\\.ya?ml$': '<rootDir>/__mocks__/yamlTransform.cjs',
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        module: {
          type: 'commonjs',
          noInterop: true,
        },
        minify: false,
      },
    ],
  },
  setupFiles: ['./setup-globals.ts'],
  setupFilesAfterEnv: ['./setup-tests.ts'],
  testPathIgnorePatterns: ['integration-tests'],
};

export default config;
