import { FiberNode } from './FiberNode.type'

type ComponentName = string

export const store = {
  inspectionQueue: [] as ((committedFiberRoot: FiberNode) => void)[],
  perComponent: {} as Record<ComponentName, { renderTimes: number[] }>
}
