declare module 'twd-js/bundled' {
  import type { TWDTheme } from 'twd-js'

  interface InitTWDOptions {
    open?: boolean
    position?: 'left' | 'right'
    serviceWorker?: boolean
    serviceWorkerUrl?: string
    theme?: Partial<TWDTheme>
    search?: boolean
    rootSelector?: string
  }

  type TestModule = Record<string, () => Promise<unknown>>

  export const initTWD: (
    files: TestModule,
    options?: InitTWDOptions,
  ) => void
}

declare module 'twd-js/runner' {
  interface Handler {
    id: string
    name: string
    parent?: string
    handler: () => void | Promise<void>
    children?: string[]
    type: 'suite' | 'test'
    status?: 'idle' | 'pass' | 'fail' | 'skip' | 'running'
    logs: string[]
    depth: number
    only?: boolean
    skip?: boolean
  }

  type HookFn = () => void | Promise<void>

  export const handlers: Map<string, Handler>
  export const describe: {
    (name: string, handler: () => void): void
    only(name: string, handler: () => void): void
    skip(name: string, handler: () => void): void
  }
  export const it: {
    (name: string, handler: () => void | Promise<void>): void
    only(name: string, handler: () => void | Promise<void>): void
    skip(name: string, handler?: () => void | Promise<void>): void
  }
  export const beforeEach: (fn: HookFn) => void
  export const afterEach: (fn: HookFn) => void
  export const clearTests: () => void
}

declare module 'twd-relay/browser' {
  interface BrowserClientOptions {
    url?: string
    path?: string
    reconnect?: boolean
    reconnectInterval?: number
    log?: boolean
    maxTestDurationMs?: number
  }

  interface BrowserClient {
    connect(): void
    disconnect(): void
    readonly connected: boolean
  }

  export const createBrowserClient: (
    options?: BrowserClientOptions,
  ) => BrowserClient
}
