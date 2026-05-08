/**
 * Shared test utilities for login and register page tests.
 * Eliminates duplicated mock setup between login.test.tsx and register.test.tsx.
 *
 * Note: jest.mock() calls must remain in each test file (they run in sandboxed scope).
 * This file only exports mock functions, localStorage mock, and helper utilities.
 */

export const mockedLogin = jest.fn();
export const mockedCurrentUser = jest.fn();
export const mockedRegister = jest.fn();
export const mockedSubmitOnboardingProfile = jest.fn();
export const mockedGetJobTitleOptions = jest.fn();

export const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

export const createMockLocation = (href: string) => {
  const url = new URL(href);
  return {
    href,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  } as unknown as Location;
};

export function resetAllMocks() {
  mockedLogin.mockReset();
  mockedCurrentUser.mockReset();
  mockedRegister.mockReset();
  mockedSubmitOnboardingProfile.mockReset();
  mockedGetJobTitleOptions.mockReset();
  localStorageMock.clear();
}
