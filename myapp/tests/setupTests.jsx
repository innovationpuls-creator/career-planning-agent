// Make React available as a global so esbuild's jsx:"react" transform can find it
global.React = require('react');

jest.mock('antd-style', () => {
  const actual = jest.requireActual('antd-style');
  return {
    ...actual,
    keyframes: (strings) => `anim-${strings[0].length}`,
  };
});

import { defaultConfig } from 'antd/lib/theme/internal';

defaultConfig.hashed = false;

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock;

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserver;
window.ResizeObserver = ResizeObserver;

class Worker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage(msg) {
    this.onmessage(msg);
  }
}
window.Worker = Worker;

if (typeof window !== 'undefined') {
  // ref: https://github.com/ant-design/ant-design/issues/18774
  if (!window.matchMedia) {
    Object.defineProperty(global.window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
  }
  if (!window.matchMedia) {
    Object.defineProperty(global.window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn((query) => ({
        matches: query.includes('max-width'),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
  }
}
const errorLog = console.error;
Object.defineProperty(global.window.console, 'error', {
  writable: true,
  configurable: true,
  value: (...rest) => {
    const logStr = rest.join('');
    if (
      logStr.includes(
        'Warning: An update to %s inside a test was not wrapped in act(...)',
      )
    ) {
      return;
    }
    errorLog(...rest);
  },
});
