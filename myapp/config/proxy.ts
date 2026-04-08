/**
 * @name Proxy config
 * @see Proxy only affects local development and test environments.
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  dev: {
    '/api/': {
      target: 'http://127.0.0.1:9100',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
  test: {
    '/api/': {
      target: 'http://127.0.0.1:9100',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
};
