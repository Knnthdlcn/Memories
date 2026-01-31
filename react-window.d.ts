declare module 'react-window' {
  import * as React from 'react'

  export type GridChildComponentProps = {
    columnIndex: number
    rowIndex: number
    style: React.CSSProperties
    data?: any
  }

  export type FixedSizeGridProps = {
    columnCount: number
    columnWidth: number
    height: number
    rowCount: number
    rowHeight: number
    width: number
    children: (props: GridChildComponentProps) => React.ReactNode
  }

  export class FixedSizeGrid extends React.Component<FixedSizeGridProps> {}
}
