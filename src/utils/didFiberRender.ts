import { FiberNode } from '../FiberNode.type'

export function didFiberRender(prevFiber: FiberNode, nextFiber: FiberNode): boolean {
  switch (nextFiber.tag) {
    case ReactTypeOfWork.ClassComponent:
    case ReactTypeOfWork.FunctionComponent:
    case ReactTypeOfWork.ContextConsumer:
    case ReactTypeOfWork.MemoComponent:
    case ReactTypeOfWork.SimpleMemoComponent:
    case ReactTypeOfWork.ForwardRef:
      // For types that execute user code, we check PerformedWork effect.
      // We don't reflect bailouts (either referential or sCU) in DevTools.
      // eslint-disable-next-line no-bitwise
      return (
        (getFiberFlags(nextFiber) & ReactTypeOfSideEffect.PerformedWork) ===
        ReactTypeOfSideEffect.PerformedWork
      )
    // Note: ContextConsumer only gets PerformedWork effect in 16.3.3+
    // so it won't get highlighted with React 16.3.0 to 16.3.2.
    default:
      // For host components and other types, we compare inputs
      // to determine whether something is an update.
      return (
        prevFiber.memoizedProps !== nextFiber.memoizedProps ||
        prevFiber.memoizedState !== nextFiber.memoizedState ||
        prevFiber.ref !== nextFiber.ref
      )
  }
}

function getFiberFlags(fiber: FiberNode): number {
  // The name of this field changed from "effectTag" to "flags"
  return fiber.flags !== undefined ? fiber.flags : (fiber as any).effectTag
}

const ReactTypeOfWork = {
  ClassComponent: 1,
  ContextConsumer: 9,
  ContextProvider: 10,
  CoroutineComponent: -1, // Removed
  CoroutineHandlerPhase: -1, // Removed
  DehydratedSuspenseComponent: 18, // Behind a flag
  ForwardRef: 11,
  Fragment: 7,
  FunctionComponent: 0,
  HostComponent: 5,
  HostPortal: 4,
  HostRoot: 3,
  HostText: 6,
  IncompleteClassComponent: 17,
  IndeterminateComponent: 2,
  LazyComponent: 16,
  LegacyHiddenComponent: 23,
  MemoComponent: 14,
  Mode: 8,
  OffscreenComponent: 22, // Experimental
  Profiler: 12,
  ScopeComponent: 21, // Experimental
  SimpleMemoComponent: 15,
  SuspenseComponent: 13,
  SuspenseListComponent: 19, // Experimental
  TracingMarkerComponent: 25, // Experimental - This is technically in 18 but we don't
  // want to fork again so we're adding it here instead
  YieldComponent: -1 // Removed
} as const

const ReactTypeOfSideEffect = {
  DidCapture: 0b10000000,
  NoFlags: 0b00,
  PerformedWork: 0b01,
  Placement: 0b10,
  Incomplete: 0b10000000000000,
  Hydrating: 0b1000000000000
} as const
