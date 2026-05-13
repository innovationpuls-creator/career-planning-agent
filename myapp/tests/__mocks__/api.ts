// Default mock for @/services/ant-design-pro/api
// Individual tests override specific methods via jest.spyOn or manual mock overrides.
const mockFn = (..._args: unknown[]) => Promise.resolve({ data: {} });

module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default') return module.exports;
      return mockFn;
    },
  },
);
