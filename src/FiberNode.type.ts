export interface ContextListItem {
  context: {
    displayName?: string
  }
  memoizedValue: any
  next?: ContextListItem
}

export interface FiberNode {
  tag: number
  flags: number | undefined
  child: FiberNode | null
  sibling: FiberNode | null
  alternate: FiberNode | null
  ref?: any
  memoizedState: any
  memoizedProps: any
  dependencies: {
    firstContext?: ContextListItem
  } | null
  elementType?: {
    displayName?: string
  }
}
