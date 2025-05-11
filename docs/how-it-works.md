# How it works

High level activities:

1. Component wrapping
2. Dev Tools Hook injection
3. Fiber tree inspection after render

Detailed flow:

- `warnManyRerenders` wraps your component in `React.Profiler` to observe renders via "onRender"
- It delays fiber inspection until commit phase (`store.inspectionQueue`), because props and hook values are not stable yet
- It waits until commit phase by injecting code into React DevTools hook "onCommitFiberRoot" (`injectDevToolsHookOnce`), which iterates `store.inspectionQueue`.
- During fiber inspection it compares props, context and hook values against previous once to detect render reason
- It uses `react-debug-tools` package to parse hooks from fiber, it is the package that is being used by React Dev Tools itself
