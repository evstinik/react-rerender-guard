declare module 'react-debug-tools' {
  interface HookInfo {
    id: number | null
    isStateEditable: boolean
    name: 'Context' | 'Reducer' | 'LayoutEffect' | 'Ref' | 'Memo' | 'Callback' | 'State'
    subHooks: HookInfo[]
    value: any
  }

  function inspectHooksOfFiber(fiber: any): HookInfo[]
}
