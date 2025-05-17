import React from 'react'
import { Tooltip, TooltipProps, useMediaQuery, useTheme } from '@mui/material'
import { merge } from 'lodash'
import theme from '../theme'

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
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  
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
        fontSize: isPhone ? '8px' : '10px',
        lineHeight: isPhone ? '12px' : '14px',
        padding: isPhone ? '2px 4px' : '4px 8px',
        pointerEvents: 'auto',
        maxWidth: isPhone ? '150px' : '300px',
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
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const offsetOptions: Record<string, unknown> = {}

  switch (props.placement) {
  case 'bottom':
    offsetOptions.offset = [0, -4]
    break
  case 'right':
    offsetOptions.offset = isPhone ? [0, 0] : [0, 2]
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
