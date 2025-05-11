import { CounterContextProvider } from './CounterContext'
import { Counter } from './Counter'

export default function App() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <p>Click button to trigger re-render</p>
      <CounterContextProvider>
        <Counter stringProp='something' />
        <Counter stringProp='nothing' />
      </CounterContextProvider>
      <p style={{ fontSize: 10 }}>Both components share the same context and update together</p>
    </div>
  )
}
