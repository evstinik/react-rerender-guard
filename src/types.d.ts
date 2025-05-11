export {}

declare module 'react' {
  interface Component {
    _reactInternals?: any
  }
}

declare global {
  const __REACT_DEVTOOLS_GLOBAL_HOOK__: any
  const process: any
}
