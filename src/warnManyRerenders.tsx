import React, { useRef, useEffect, useState, ComponentType, memo } from 'react'
// eslint-disable-next-line import/no-extraneous-dependencies
import * as ReactDebugTools from 'react-debug-tools'

export interface WarnManyRerendersOptions {
  /** Number of renders that trigger warning (default: 100) */
  threshold?: number
  /** Time window in ms to count renders (default: 1000) */
  timeWindow?: number
}

declare module 'react' {
  interface Component {
    _reactInternals?: any
  }
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: any
  }
}

interface ContextListItem {
  context: {
    displayName?: string
  }
  memoizedValue: any
  next?: ContextListItem
}

interface FiberNode {
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

interface HookInfo {
  id: number | null
  isStateEditable: boolean
  name: 'Context' | 'Reducer' | 'LayoutEffect' | 'Ref' | 'Memo' | 'Callback' | 'State'
  subHooks: HookInfo[]
  value: any
}

export interface FiberCaptureProps {
  /** Function to capture the fiber node */
  captureFiber: (fiber: any) => void
  /** Children to render */
  children: React.ReactNode
}

type ComponentName = string
const store: Record<ComponentName, { renderTimes: number[] }> = {}
const phases = new Set<string>()
const addPhase = (phase: string) => {
  if (!phases.has(phase)) {
    phases.add(phase)
    // console.log(`Phase added: ${phase}`)
  }
}

/**
 * Advanced HOC that works with null-returning components by accessing React Fiber directly
 *
 * @param {React.ComponentType} Component - The component to wrap
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Number of renders that trigger warning (default: 100)
 * @param {number} options.timeWindow - Time window in ms to count renders (default: 1000)
 * @returns {React.ComponentType} - The wrapped component with re-render warnings
 */
export function warnManyRerenders<T extends ComponentType<any>>(
  Component: T,
  options: WarnManyRerendersOptions = {}
): T {
  const { threshold = 100, timeWindow = 1000 } = options

  // Get display name for the component
  const displayName = Component.displayName || Component.name || 'Component'

  // Create a special container component to get fiber access for null-returning components
  class FiberCapture extends React.Component<FiberCaptureProps> {
    componentDidMount() {
      // This provides access to the fiber node through internal React APIs
      if (this._reactInternals) {
        // React 17+
        this.props.captureFiber(this._reactInternals)
      } else {
        // Try to find fiber key
        const fiberKey = Object.keys(this).find(
          (key) => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$')
        )

        if (fiberKey) {
          this.props.captureFiber(this[fiberKey])
        }
      }
    }

    render() {
      // Just render children as is
      return this.props.children
    }
  }

  if (!store[displayName]) {
    store[displayName] = {
      renderTimes: []
    }
  }

  // Creating the wrapper component
  function WrappedComponent(props: any) {
    // For tracking renders
    const previousPropsRef = useRef({})
    const [fiberNode, setFiberNode] = useState(null)
    const childFiberRef = useRef<FiberNode | null>(null)
    const previousHookStates = useRef<any[]>([])
    const previousContextStates = useRef<Record<string, any>>({})

    // Helper to capture fiber from our container
    const captureFiber = (fiber) => {
      // Store the fiber node for our container
      if (!fiberNode) {
        setFiberNode(fiber)

        // The child fiber node points to our wrapped component
        if (fiber.child) {
          childFiberRef.current = fiber.child
        }
      }
    }

    // Helper to detect prop changes
    const detectPropChanges = (commitedFiber: FiberNode) => {
      const changedProps: string[] = []

      if (typeof commitedFiber.memoizedProps !== 'object' || commitedFiber.memoizedProps === null) {
        return changedProps
      }

      Object.keys(commitedFiber.memoizedProps).forEach((key) => {
        if (!Object.is(commitedFiber.memoizedProps[key], previousPropsRef.current[key])) {
          changedProps.push(key)
        }
      })

      previousPropsRef.current = { ...commitedFiber.memoizedProps }

      return changedProps
    }

    // Helper to detect hook changes by analyzing the fiber
    const detectHookChanges = (commitedFiber: FiberNode) => {
      const hooks = ReactDebugTools.inspectHooksOfFiber(commitedFiber)
      const hooksStack: HookInfo[] = hooks.slice().reverse()

      try {
        // Access the hook linked list through the fiber
        let currentHook = hooksStack.pop()
        let hookIndex = 0
        const changedHooks: string[] = []

        // Walk through the hook linked list
        while (currentHook) {
          // Each hook has a memoizedState property with its current value
          const currentValue = currentHook.value
          const isHookCausingRerenders = currentHook.isStateEditable

          // Compare with previous value if available
          if (
            isHookCausingRerenders &&
            previousHookStates.current[hookIndex] !== undefined &&
            !Object.is(currentValue, previousHookStates.current[hookIndex]) &&
            currentHook.id !== null
          ) {
            changedHooks.push(`Hook ${currentHook.id !== null ? currentHook.id + 1 : 'Unknown'}`)
          }
          // if (isHookCausingRerenders) {
          //   console.log(
          //     `[${(currentHook?.id ?? -2) + 1}] Prev: ${previousHookStates.current[hookIndex]} Current: ${currentValue}. Equal: ${Object.is(currentValue, previousHookStates.current[hookIndex])}`
          //   )
          // }

          // Store the current value for next comparison
          previousHookStates.current[hookIndex] = currentValue

          // Move to next hook in linked list
          hookIndex++
          hooksStack.push(...currentHook.subHooks.slice().reverse())
          currentHook = hooksStack.pop()
        }

        return changedHooks.length > 0 ? changedHooks : null
      } catch (err) {
        console.debug('Error accessing hook state:', err)
        return null
      }
    }

    // Helper to detect context changes
    const detectContextChanges = (commitedFiber: FiberNode) => {
      try {
        let currentContext: ContextListItem | undefined = commitedFiber.dependencies?.firstContext
        const changedContexts: string[] = []

        // Walk through the context linked list
        while (currentContext) {
          const currentValue = currentContext.memoizedValue
          const contextName = currentContext.context.displayName || 'Unknown Context'

          // Compare with previous value if available
          if (
            previousContextStates.current[contextName] !== undefined &&
            !Object.is(currentValue, previousHookStates.current[contextName])
          ) {
            changedContexts.push(`Context ${contextName}`)
          }

          // Store the current value for next comparison
          previousHookStates.current[contextName] = currentValue

          // Move to next context in linked list
          currentContext = currentContext.next
        }

        return changedContexts.length > 0 ? changedContexts : null
      } catch (err) {
        console.debug('Error accessing context state:', err)
        return null
      }
    }

    // Determine why the component re-rendered
    const determineRenderReason = (commitedFiber: FiberNode | null) => {
      if (!commitedFiber) {
        return 'Unknown reason'
      }

      // Check for prop changes
      const changedProps = detectPropChanges(commitedFiber)
      if (changedProps.length > 0) {
        return `Props changed: ${changedProps.join(', ')}`
      }

      // Check for hook changes
      const changedHooks = detectHookChanges(commitedFiber)
      if (changedHooks) {
        return `Hooks changed: ${changedHooks.join(', ')}`
      }

      // Check for context changes
      const changedContexts = detectContextChanges(commitedFiber)
      if (changedContexts) {
        return `Contexts changed: ${changedContexts.join(', ')}`
      }

      // If nothing else detected, it must be a parent re-render
      return 'Parent component re-rendered'
    }

    // const updateCurrentValues = () => {
    //   detectContextChanges()
    //   detectHookChanges()
    //   detectPropChanges()
    // }

    const isFiberCommited = (fiber: FiberNode | null, commitedFiber: FiberNode | null) => {
      while (commitedFiber) {
        if (fiber === commitedFiber) {
          return true
        }
        if (commitedFiber.child && isFiberCommited(fiber, commitedFiber.child)) {
          return true
        }
        commitedFiber = commitedFiber.sibling
      }
      return false
    }

    // Handler for the Profiler onRender callback
    const handleRender = (commitedFiberRoot, id, phase, actualDuration) => {
      addPhase(phase)
      // Skip mount phase
      // if (phase === 'mount') {
      //   updateCurrentValues()
      //   return
      // }

      // Detect which fiber is commited (current or alternate)
      const isCommitted = isFiberCommited(childFiberRef.current, commitedFiberRoot)
      const commitedFiber = isCommitted
        ? childFiberRef.current
        : (childFiberRef.current?.alternate ?? null)
      // console.log(isCommitted ? 'COMMITTED' : 'ALTERNATE')

      if (commitedFiber?.alternate && !didFiberRender(commitedFiber, commitedFiber.alternate)) {
        // Skip empty calls
        return
      }

      const reason = determineRenderReason(commitedFiber)
      // console.log(phase, displayName, reason)

      // Skip "Parent component re-rendered" reason, we are not able to detect correctly whether real render happened
      // if (reason === 'Parent component re-rendered') {
      //   return
      // }

      const now = Date.now()
      store[displayName].renderTimes.push(now)

      // Remove timestamps outside the time window
      const windowStart = now - timeWindow
      store[displayName].renderTimes = store[displayName].renderTimes.filter(
        (time) => time >= windowStart
      )

      // Check if threshold is exceeded
      if (store[displayName].renderTimes.length >= threshold) {
        console.warn(
          `⚠️ PERFORMANCE WARNING: <${displayName}> re-rendered ${store[displayName].renderTimes.length} times ` +
            `in ${timeWindow}ms.\nReason: ${reason}.\n`
        )

        // Reset to avoid repeated warnings
        store[displayName].renderTimes = []
      }
      //  else {
      //   updateCurrentValues()
      // }
    }

    // Update previous props after each render for next comparison
    // useEffect(() => {
    //   previousPropsRef.current = { ...props }
    // })

    // Render the component inside a Profiler and our FiberCapture component
    return (
      <React.Profiler
        id={`${displayName}-profiler`}
        onRender={(...args: any) => {
          const inspect = (commitedFiberRoot) => (handleRender as any)(commitedFiberRoot, ...args)
          inspectionQueue.push(inspect)
          injectDevToolsHookIfNeeded()
        }}
      >
        <FiberCapture captureFiber={captureFiber}>
          <Component {...(props as any)} />
        </FiberCapture>
      </React.Profiler>
    )
  }

  // Set display name for debugging
  WrappedComponent.displayName = `warnManyRerenders(${displayName})`

  return memo(WrappedComponent) as unknown as T
}

const inspectionQueue: any[] = []

declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: any

let injected = false
function injectDevToolsHookIfNeeded() {
  if (injected) {
    return
  }
  injected = true

  // Only works if devtools hook is present (e.g. in dev mode or when injected manually)
  const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__
  if (hook && hook.onCommitFiberRoot) {
    const origCommit = hook.onCommitFiberRoot
    hook.onCommitFiberRoot = function (rendererID, root, ...args) {
      // This fiber tree is fully committed and stable
      const committedFiber = root.current
      // console.log('Committed fiber:', committedFiber)
      // inspectFiber(committedFiber)

      // You can walk and inspect the fiber tree here
      inspectionQueue.forEach((inspect) => inspect(committedFiber))
      inspectionQueue.length = 0

      // Call original to preserve DevTools behavior
      return origCommit.call(this, rendererID, root, ...args)
    }
  } else {
    console.warn(
      'React DevTools hook not found. Rerender warnings will not be available in production.'
    )
  }
}

const inspectFiber = (fiber: FiberNode) => {
  if (fiber.elementType?.displayName === 'Test') {
    console.log('Inspecting fiber:', fiber)
    console.log('Count value: ', ReactDebugTools.inspectHooksOfFiber(fiber)[0].subHooks[1].value[1])
  }

  if (fiber.child) {
    inspectFiber(fiber.child)
  }
  if (fiber.sibling) {
    inspectFiber(fiber.sibling)
  }
}

function didFiberRender(prevFiber: FiberNode, nextFiber: FiberNode): boolean {
  switch (nextFiber.tag) {
    case ClassComponent:
    case FunctionComponent:
    case ContextConsumer:
    case MemoComponent:
    case SimpleMemoComponent:
    case ForwardRef:
      // For types that execute user code, we check PerformedWork effect.
      // We don't reflect bailouts (either referential or sCU) in DevTools.
      // eslint-disable-next-line no-bitwise
      return (getFiberFlags(nextFiber) & PerformedWork) === PerformedWork
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

const {
  getDisplayNameForFiber,
  getTypeSymbol,
  ReactPriorityLevels,
  ReactTypeOfWork,
  ReactTypeOfSideEffect,
  StrictModeBits
} = {
  DidCapture: 0b10000000,
  NoFlags: 0b00,
  PerformedWork: 0b01,
  Placement: 0b10,
  Incomplete: 0b10000000000000,
  Hydrating: 0b1000000000000,
  CacheComponent: 24, // Experimental
  ReactTypeOfSideEffect: {
    DidCapture: 0b10000000,
    NoFlags: 0b00,
    PerformedWork: 0b01,
    Placement: 0b10,
    Incomplete: 0b10000000000000,
    Hydrating: 0b1000000000000
  },
  ReactTypeOfWork: {
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
  }
} as any
const { DidCapture, Hydrating, NoFlags, PerformedWork, Placement } = ReactTypeOfSideEffect
const {
  CacheComponent,
  ClassComponent,
  ContextConsumer,
  DehydratedSuspenseComponent,
  ForwardRef,
  Fragment,
  FunctionComponent,
  HostRoot,
  HostPortal,
  HostComponent,
  HostText,
  IncompleteClassComponent,
  IndeterminateComponent,
  LegacyHiddenComponent,
  MemoComponent,
  OffscreenComponent,
  SimpleMemoComponent,
  SuspenseComponent,
  SuspenseListComponent,
  TracingMarkerComponent
} = ReactTypeOfWork
