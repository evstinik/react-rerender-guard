import React from 'react'
import { FiberNode } from '../FiberNode.type'

export interface FiberCaptureProps {
  /** Function to capture the fiber node */
  captureFiber: (fiber: FiberNode) => void
  /** Children to render */
  children: React.ReactNode
}

/** Util component to capture fiber from the child component */
export class FiberCapture extends React.Component<FiberCaptureProps> {
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
    return this.props.children
  }
}
