declare module 'react-virtualized-auto-sizer' {
  import * as React from 'react'

  export type AutoSizerProps = {
    children: (size: { height: number; width: number }) => React.ReactNode
    disableHeight?: boolean
    disableWidth?: boolean
    defaultHeight?: number
    defaultWidth?: number
    style?: React.CSSProperties
    className?: string
  }

  export default class AutoSizer extends React.Component<AutoSizerProps> {}
}
