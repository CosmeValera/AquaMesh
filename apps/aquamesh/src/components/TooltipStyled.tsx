import React from 'react'
import { Tooltip, TooltipProps } from '@mui/material'
import { merge } from 'lodash'

interface TooltipStyledProps extends Omit<TooltipProps, 'componentsProps' | 'slotProps'> {
  componentsProps?: {
    tooltip?: Record<string, unknown>;
    arrow?: Record<string, unknown>;
  };
  slotProps?: {
    popper?: Record<string, unknown>;
  };
  placement?: 'bottom' | 'right' | 'left' | 'top';
}

// TODO: This belongs in style...
const styledComponentsProps = (props: TooltipStyledProps) => {
  const tooltip: Record<string, unknown> = {}
  const arrow: Record<string, unknown> = {}

  switch (props.placement) {
  case 'right':
    arrow.transform = 'translate3d(1px, 6px, 0) !important'
    tooltip.marginLeft = '100px'
    break
  default:
    arrow.transform = 'none'
  }

  return {
    tooltip: {
      sx: {
        ...tooltip,
        borderRadius: 0,
        fontSize: '10px',
        lineHeight: '14px',
        padding: '4px 8px',
        pointerEvents: 'auto',
        boxShadow: `
          0 5px 22px 4px #0000001F,
          0 12px 17px 2px #00000024,
          0 7px 8px -4px #00000033
        `,
      },
    },
    arrow: {
      sx: {
        ...arrow,
        pointerEvents: 'auto',
      },
    },
  }
}

const styledSlotProps = (props: TooltipStyledProps) => {
  const offsetOptions: Record<string, unknown> = {}

  switch (props.placement) {
  case 'bottom':
    offsetOptions.offset = [0, -4]
    break
  case 'right':
    offsetOptions.offset = [0, 2]
    break
  default:
    offsetOptions.offset = [0, 0]
  }

  return {
    popper: {
      sx: {
        pointerEvents: 'none',
      },
      modifiers: [
        {
          name: 'offset',
          options: offsetOptions,
        },
      ],
    },
  }
}

const TooltipStyled: React.FC<TooltipStyledProps> = (props) => {
  const { componentsProps, slotProps, ...rest } = props

  const mergedComponentsProps = merge(
    {},
    styledComponentsProps(props),
    componentsProps,
  )

  const mergedSlotProps = merge({}, styledSlotProps(props), slotProps)

  return (
    <Tooltip
      componentsProps={mergedComponentsProps}
      slotProps={mergedSlotProps}
      {...rest}
    />
  )
}

export default TooltipStyled
