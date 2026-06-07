type WebpackContext = {
  keys: () => string[]
  (key: string): unknown
}

type WebpackRequire = {
  context: (
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ) => WebpackContext
}

const loadTwdTestModules = (): Record<string, () => Promise<unknown>> => {
  const webpackRequire = require as unknown as WebpackRequire
  const context = webpackRequire.context('../', true, /\.twd\.test\.ts$/)

  return context.keys().reduce<Record<string, () => Promise<unknown>>>(
    (modules, key) => {
      modules[key] = async () => context(key)
      return modules
    },
    {},
  )
}

export const initTwdInDevelopment = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const [{ initTWD }, { createBrowserClient }] = await Promise.all([
    import('twd-js/bundled'),
    import('twd-relay/browser'),
  ])

  initTWD(loadTwdTestModules(), {
    open: false,
    position: 'right',
    search: true,
    rootSelector: '#root',
    serviceWorker: false,
  })

  createBrowserClient({
    url: 'ws://localhost:9876/__twd/ws',
    reconnect: true,
    log: false,
    maxTestDurationMs: 20000,
  }).connect()
}
