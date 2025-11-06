'use client'

import { Handle, Position, HandleProps } from '@xyflow/react'

interface CustomHandleProps extends HandleProps {
  type: 'target' | 'source'
  position: Position
}

export function CustomHandle({ type, position, id, style, className, ...props }: CustomHandleProps) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: '#616161',
        border: '1.5px solid #212121',
        cursor: 'crosshair',
        ...style,
      }}
      className={className}
      {...props}
    />
  )
}

