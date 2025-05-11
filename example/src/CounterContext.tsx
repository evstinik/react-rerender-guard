import { useState, useCallback, useMemo } from 'react'
import { createContext } from 'use-context-selector'

export const CounterContext = createContext({ count: 0, increase: () => {} })

export const CounterContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0)

  const increase = useCallback(() => {
    setCount((prev) => prev + 1)
  }, [])

  const value = useMemo(() => ({ count, increase }), [count, increase])

  return <CounterContext.Provider value={value}>{children}</CounterContext.Provider>
}
