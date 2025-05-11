import { FC, memo } from 'react'
import { useContextSelector } from 'use-context-selector'
import { CounterContext } from './CounterContext'
import { warnManyRerenders } from 'react-rerender-guard'

const CounterBase: FC<{ stringProp?: string }> = memo(() => {
  const count = useContextSelector(CounterContext, (ctx) => ctx.count)
  const increase = useContextSelector(CounterContext, (ctx) => ctx.increase)

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div>Count: {count}</div>
      <div>
        <button onClick={increase}>Inc</button>
      </div>
    </div>
  )
})
CounterBase.displayName = 'Counter'

export const Counter = warnManyRerenders(CounterBase, {
  threshold: 3,
  timeWindow: 3000
})
