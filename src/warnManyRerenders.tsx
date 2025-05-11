import React, { useRef, useState, ComponentType, memo } from 'react'
import { inspectHooksOfFiber } from 'react-debug-tools'
import { ContextListItem, FiberNode } from './FiberNode.type'
import { didFiberRender } from './utils/didFiberRender'
import { FiberCapture } from './utils/FiberCapture'
import { injectDevToolsHookOnce } from './utils/injectDevToolsHook'
import { store } from './store'
import { isInProduction } from './utils/isInProduction'

export interface WarnManyRerendersOptions {
  /** Number of renders that trigger warning (default: 100) */
  threshold?: number
  /** Time window in ms to count renders (default: 1000) */
  timeWindow?: number
}

/**
 * High-order component that wraps a React component and logs a warning if it re-renders too many times.
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
  if (isInProduction()) {
    return Component
  }

  const { threshold = 100, timeWindow = 1000 } = options

  // Get display name for the component
  const displayName = Component.displayName || Component.name || 'Component'

  if (!store.perComponent[displayName]) {
    store.perComponent[displayName] = {
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
      const hooks = inspectHooksOfFiber(commitedFiber)
      const hooksStack = hooks.slice().reverse()

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
    const handleRender = (commitedFiberRoot: FiberNode) => {
      // Detect which fiber is commited (current or alternate)
      const isCommitted = isFiberCommited(childFiberRef.current, commitedFiberRoot)
      const commitedFiber = isCommitted
        ? childFiberRef.current
        : (childFiberRef.current?.alternate ?? null)

      if (commitedFiber?.alternate && !didFiberRender(commitedFiber, commitedFiber.alternate)) {
        // Skip empty calls
        return
      }

      const reason = determineRenderReason(commitedFiber)

      const now = Date.now()
      store.perComponent[displayName].renderTimes.push(now)

      // Remove timestamps outside the time window
      const windowStart = now - timeWindow
      store.perComponent[displayName].renderTimes = store.perComponent[
        displayName
      ].renderTimes.filter((time) => time >= windowStart)

      // Check if threshold is exceeded
      if (store.perComponent[displayName].renderTimes.length >= threshold) {
        console.warn(
          `⚠️ PERFORMANCE WARNING: <${displayName}> re-rendered ${store.perComponent[displayName].renderTimes.length} times ` +
            `in ${timeWindow}ms.\nReason: ${reason}.\n`
        )

        // Reset to avoid repeated warnings
        store.perComponent[displayName].renderTimes = []
      }
    }

    // Render the component inside a Profiler and our FiberCapture component
    return (
      <React.Profiler
        id={`${displayName}-profiler`}
        onRender={() => {
          // Do not inspect render immediately, wait for the commit phase
          store.inspectionQueue.push(handleRender)
          injectDevToolsHookOnce()
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
