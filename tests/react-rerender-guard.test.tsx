import React, { useEffect } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, RenderResult, screen, waitFor } from '@testing-library/react'
import { warnManyRerenders } from '../src/warnManyRerenders'

/**
 * Example component that simulates a re-rendering scenario when `timesToRender` is set.
 */
const ExampleRerenderableComponent: React.FC<{ timesToRender?: number }> = ({ timesToRender }) => {
  const [count, setCount] = React.useState(0)

  useEffect(() => {
    if (timesToRender !== undefined && count < timesToRender) {
      setCount(count + 1)
    }
  }, [count, timesToRender])

  return (
    <div>
      {timesToRender === undefined || count < timesToRender ? (
        <span>Count: {count}</span>
      ) : (
        <span>Done</span>
      )}
    </div>
  )
}
ExampleRerenderableComponent.displayName = 'ExampleRerenderableComponent'

/**
 * Wrapped component that tracks re-renders and prints a warning if the threshold is exceeded.
 */
const TrackedExampleRerenderableComponent = warnManyRerenders(ExampleRerenderableComponent, {
  threshold: 10,
  timeWindow: 1000
})

describe('React Rerender Guard', () => {
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => {
    mockDevToolsHook()
  })

  afterEach(() => {
    consoleSpy.mockClear()
  })

  it('prints warning when rendered 10 or more times in 1000ms', async () => {
    // Render the component with the wrapper and let it stabilize

    let result: RenderResult | null = null
    result = render(<TrackedExampleRerenderableComponent />, {
      wrapper: (props) => (
        <WrapperMockingCommitFiberRootHookCalls {...props} container={result?.container} />
      )
    }) as RenderResult
    await waitFor(() => expect(result).toBeTruthy())

    // Now simulate the re-renders by setting "timesToRender" to 10
    // This will cause the component to re-render 10 times in quick succession
    // and trigger the warning

    result?.rerender(<TrackedExampleRerenderableComponent timesToRender={10} />)

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'PERFORMANCE WARNING: <ExampleRerenderableComponent> re-rendered 10 times in 1000ms.\nReason: Hooks changed: Hook 1.'
      )
    )
  })
})

/**
 * Mocks the React DevTools global hook to prevent actual DevTools integration.
 *
 * React Rerender Guard relies on React DevTools Global Hook to track re-renders.
 */
function mockDevToolsHook() {
  // Clear any existing hook
  delete (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__

  // Mock hook
  ;(globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => {},
    onCommitFiberRoot: vi.fn(),
    onCommitFiberUnmount: vi.fn()
  }
}

/**
 * Wrapper component that simulates calls from React of the DevTools hook "onCommitFiberRoot"
 */
const WrapperMockingCommitFiberRootHookCalls: React.FC<
  React.PropsWithChildren<{ container?: RenderResult['container'] }>
> = ({ children, container }) => (
  <React.Profiler
    id='test'
    onRender={() => {
      if (container) {
        globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot('', getFiberRoot(container))
      }
    }}
  >
    {children}
  </React.Profiler>
)

/**
 * Utility function to get the Fiber root from the testing container.
 */
function getFiberRoot(container: RenderResult['container']) {
  const reactRootKey = Object.keys(container).find((key) => key.startsWith('__reactContainer$'))
  const reactRoot = (container as any)[reactRootKey!]
  return { current: reactRoot }
}
