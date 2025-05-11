import { store } from '../store'
import { isInProduction } from './isInProduction'

let injected = false
export function injectDevToolsHookOnce() {
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

      // You can walk and inspect the fiber tree here
      store.inspectionQueue.forEach((inspect) => inspect(committedFiber))
      store.inspectionQueue.length = 0

      // Call original to preserve DevTools behavior
      return origCommit.call(this, rendererID, root, ...args)
    }
  } else {
    if (!isInProduction()) {
      console.warn(
        'React Rerender Guard: React DevTools hook not found. Rerender warnings will not be available in production.'
      )
    }
  }
}
