import React from 'react'
import { Box, Button, IconButton, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { Tab } from 'react-tabs'
import TooltipStyled from '../TooltipStyled'
import { ReactComponent as AddIcon } from '../../icons/add.svg'
import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import type { StateDashboard } from '../../state/store'
import { hasDashboardContent } from './dashboardLayoutUtils'

interface DashboardTabsBarProps {
  dashboards: StateDashboard[]
  selectedDashboard: number
  isAdmin: boolean
  isMobileDashboardView: boolean
  variant: 'mobile-list' | 'workspace-header'
  onSelectDashboard: (index: number) => void
  onCreateDashboard: () => void
  onEditDashboard: (dashboard: StateDashboard) => void
  onRemoveDashboard: (dashboardId: string) => void
  onOpenTabMenu: (event: React.MouseEvent, tabIndex: number) => void
  onDragStart: (event: React.DragEvent, tabIndex: number) => void
  onDragOverList: (event: React.DragEvent) => void
  onDropAtEnd: (event: React.DragEvent) => void
  onDropTab: (event: React.DragEvent, targetIndex: number) => void
  onDragEnd: () => void
}

const isEmptyDashboard = (dashboard: StateDashboard) =>
  dashboard.kind !== 'studyPathContainer' &&
  !hasDashboardContent(dashboard.layout)

const getDashboardTabName = (dashboard: StateDashboard) =>
  isEmptyDashboard(dashboard) && dashboard.name === 'Dashboard'
    ? 'Empty Dashboard'
    : dashboard.name

const DashboardTabLabel = ({ dashboard }: { dashboard: StateDashboard }) => {
  const tabName = getDashboardTabName(dashboard)

  return (
    <TooltipStyled title={tabName} placement="bottom" enterTouchDelay={1000}>
      <Typography
        component="span"
        variant="subtitle2"
        sx={{
          flex: '1 0 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginLeft: '0.5rem',
        }}
      >
        {tabName}
      </Typography>
    </TooltipStyled>
  )
}

const DashboardTabActions = ({
  dashboard,
  canEdit,
  canClose,
  onEditDashboard,
  onRemoveDashboard,
}: {
  dashboard: StateDashboard
  canEdit: boolean
  canClose: boolean
  onEditDashboard: (dashboard: StateDashboard) => void
  onRemoveDashboard: (dashboardId: string) => void
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    {canEdit && (
      <TooltipStyled title="Edit Dashboard">
        <IconButton
          aria-label={`Edit dashboard ${dashboard.name}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation()
            onEditDashboard(dashboard)
          }}
          sx={{
            p: 0.5,
            mr: 0.5,
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </TooltipStyled>
    )}
    {canClose && (
      <Box
        className="close"
        sx={{
          display: 'flex',
          p: 0.5,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '999px',
          transition: 'all .25s ease',
          '&:hover': {
            backgroundColor: 'action.contrastHover',
          },
        }}
      >
        <CloseIcon
          width={16}
          height={16}
          onClick={(event) => {
            event.stopPropagation()
            onRemoveDashboard(dashboard.id)
          }}
        />
      </Box>
    )}
  </Box>
)

const AddDashboardButton = ({
  variant,
  onCreateDashboard,
}: {
  variant: DashboardTabsBarProps['variant']
  onCreateDashboard: () => void
}) => {
  if (variant === 'workspace-header') {
    return (
      <Button
        size="small"
        variant="text"
        disableRipple
        data-testid="add-dashboard-button"
        className="react-tabs__add-tab-button"
        sx={{
          minWidth: 34,
          width: 34,
          height: 34,
          alignSelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          color: 'primary.light',
          borderRadius: 999,
          transition: 'all .25s ease',
          '.MuiButton-startIcon': {
            m: 0,
            color: 'primary.light',
          },
          ':hover': {
            backgroundColor: 'action.hover',
            color: 'primary.main',
            '.MuiButton-startIcon': {
              color: 'primary.main',
            },
          },
        }}
        startIcon={<AddIcon width={16} height={16} />}
        onClick={onCreateDashboard}
      />
    )
  }

  return (
    <Button
      size="small"
      variant="text"
      disableRipple
      data-testid="add-dashboard-button"
      sx={{
        position: 'relative',
        top: 0,
        marginBottom: 0,
        minWidth: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        p: '4px 12px',
        color: 'primary.light',
        transition: 'all .25s ease',
        '.MuiButton-startIcon': {
          transition: 'all .25s ease',
          m: 0,
          color: 'primary.light',
        },
        ':hover': {
          backgroundColor: 'transparent',
          color: 'primary.main',
          '.MuiButton-startIcon': {
            color: 'primary.main',
          },
        },
      }}
      startIcon={<AddIcon width={16} height={16} />}
      onClick={onCreateDashboard}
    />
  )
}

const DashboardTabsBar = ({
  dashboards,
  selectedDashboard,
  isAdmin,
  isMobileDashboardView,
  variant,
  onSelectDashboard,
  onCreateDashboard,
  onEditDashboard,
  onRemoveDashboard,
  onOpenTabMenu,
  onDragStart,
  onDragOverList,
  onDropAtEnd,
  onDropTab,
  onDragEnd,
}: DashboardTabsBarProps) => {
  const renderActions = (dashboard: StateDashboard, canEdit: boolean) => {
    const isOnlyEmptyDashboard =
      dashboards.length === 1 && isEmptyDashboard(dashboard)

    return (
      <DashboardTabActions
        dashboard={dashboard}
        canEdit={canEdit}
        canClose={!isOnlyEmptyDashboard}
        onEditDashboard={onEditDashboard}
        onRemoveDashboard={onRemoveDashboard}
      />
    )
  }

  if (variant === 'workspace-header') {
    return (
      <Box
        className="react-tabs__tab-list react-tabs__tab-list--workspace-header"
        onDragOver={onDragOverList}
        onDrop={onDropAtEnd}
      >
        {dashboards.map((dashboard, index) => {
          const isSelected = selectedDashboard === index

          return (
            <Box
              key={dashboard.id}
              component="div"
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              draggable
              className={`react-tabs__tab ${
                isSelected ? 'react-tabs__tab--selected' : ''
              }`.trim()}
              onClick={() => onSelectDashboard(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectDashboard(index)
                }
              }}
              onDragStart={(event) => onDragStart(event, index)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => onDropTab(event, index)}
              onDragEnd={onDragEnd}
              onContextMenu={(event) => onOpenTabMenu(event, index)}
            >
              <DashboardTabLabel dashboard={dashboard} />
              {renderActions(dashboard, isAdmin)}
            </Box>
          )
        })}
        {isAdmin && (
          <AddDashboardButton
            variant={variant}
            onCreateDashboard={onCreateDashboard}
          />
        )}
      </Box>
    )
  }

  return (
    <>
      {dashboards.map((dashboard, index) => (
        <Tab
          key={dashboard.id}
          draggable={!isMobileDashboardView}
          onDragStart={(event) =>
            !isMobileDashboardView && onDragStart(event, index)
          }
          onDragOver={(event) => {
            if (isMobileDashboardView) {
              return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => !isMobileDashboardView && onDropTab(event, index)}
          onDragEnd={onDragEnd}
          onContextMenu={(event) => onOpenTabMenu(event, index)}
        >
          <DashboardTabLabel dashboard={dashboard} />
          {renderActions(dashboard, !isMobileDashboardView && isAdmin)}
        </Tab>
      ))}
      {isAdmin && (
        <AddDashboardButton
          variant={variant}
          onCreateDashboard={onCreateDashboard}
        />
      )}
    </>
  )
}

export default DashboardTabsBar
