import React from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Collapse,
  Tooltip,
  InputAdornment
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { ComponentPreviewProps } from '../../types/types'
import { getComponentIcon } from '../../constants/componentTypes'
import ChartPreview from './ChartPreview'
import AddIcon from '@mui/icons-material/Add'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CodeIcon from '@mui/icons-material/Code'
import SettingsIcon from '@mui/icons-material/Settings'
import PreviewIcon from '@mui/icons-material/Preview'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SaveIcon from '@mui/icons-material/Save'
import SendIcon from '@mui/icons-material/Send'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

// Fix for type issues with MUI icons
type IconType = React.ElementType;

const ComponentPreview: React.FC<ComponentPreviewProps> = ({
  component,
  onEdit,
  onToggleCollapse,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddInside,
  isFirst,
  isLast,
  level = 0,
  editMode,
  isDragging,
  dropTarget,
  handleContainerDragEnter,
  handleContainerDragOver,
  handleContainerDragLeave,
  handleContainerDrop,
  onToggleVisibility,
  showWidgetName
}) => {
  const isCurrentTarget = dropTarget.id === component.id && dropTarget.isHovering
  const isHidden = Boolean(component.hidden)

  // Get the component icon for display
  const ComponentIcon = getComponentIcon(component.type) as IconType

  // Render a preview of the component based on its type
  const renderComponent = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <FormControlLabel
            control={
              <Switch 
                defaultChecked={component.props.defaultChecked as boolean}
                disabled={Boolean(component.props.disabled)}
                size={component.props.size as 'small' | 'medium'}
                sx={component.props.useCustomColor ? {
                  color: component.props.customColor as string,
                  '& .MuiSwitch-track': {
                    backgroundColor: component.props.customTrackColor as string
                  }
                } : undefined}
                onChange={(e) => {
                  if (component.props.showToast) {
                    const isChecked = e.target.checked;
                    const message = isChecked 
                      ? (component.props.onMessage as string || 'Switch turned ON')
                      : (component.props.offMessage as string || 'Switch turned OFF');
                    const severity = component.props.toastSeverity as string || 'info';
                    
                    // Dispatch custom event for toast
                    const customEvent = new CustomEvent('showWidgetToast', {
                      detail: {
                        message,
                        severity
                      },
                      bubbles: true
                    });
                    document.dispatchEvent(customEvent);
                  }
                }}
              />
            }
            label={component.props.label as string}
            labelPlacement={component.props.labelPlacement as 'end' | 'start' | 'top' | 'bottom' || 'end'}
          />
        )
      case 'FieldSet': {
        const isCollapsed = component.props.collapsed as boolean;
        const borderStyle = component.props.borderStyle as string || 'solid';
        const borderRadius = (component.props.borderRadius as number) || 4;
        const padding = (component.props.padding as number) || 2;
        const useCustomBorderColor = Boolean(component.props.useCustomBorderColor);
        const useCustomLegendColor = Boolean(component.props.useCustomLegendColor);
        const borderColor = useCustomBorderColor ? (component.props.borderColor as string || '#cccccc') : '#cccccc';
        const legendColor = useCustomLegendColor ? (component.props.legendColor as string || '#00C49A') : '#00C49A';
        const iconPosition = component.props.iconPosition as string || 'start';
        const animated = component.props.animated !== false;
        
        return (
          <Box
            sx={{
              position: 'relative',
              border: `1px ${borderStyle} ${borderColor}`,
              borderRadius: borderRadius,
              p: padding,
              mt: 1.5, // Space for legend
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : 'transparent',
              borderStyle: isCurrentTarget ? 'dashed' : borderStyle,
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            {/* Legend */}
            <Box sx={{ 
              position: 'absolute', 
              top: -10, 
              left: 10,
              bgcolor: 'background.paper',
              px: 1,
              display: 'flex',
              alignItems: 'center'
            }}>
              {iconPosition === 'start' && (
                <Box 
                  component="span" 
                  sx={{ 
                    cursor: 'pointer', 
                    color: legendColor,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (onToggleCollapse) {
                      onToggleCollapse(component.id); 
                    }
                  }}
                >
                  {isCollapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
                </Box>
              )}
              
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  color: legendColor,
                  fontWeight: 'bold',
                  mx: 0.5,
                  cursor: 'pointer'
                }}
                onClick={(e) => { 
                  e.stopPropagation();
                  if (onToggleCollapse) {
                    onToggleCollapse(component.id);
                  }
                }}
              >
                {component.props.legend as string || 'Field Set'}
              </Typography>
              
              {iconPosition === 'end' && (
                <Box 
                  component="span" 
                  sx={{ 
                    cursor: 'pointer', 
                    color: legendColor,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (onToggleCollapse) {
                      onToggleCollapse(component.id); 
                    }
                  }}
                >
                  {isCollapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
                </Box>
              )}
            </Box>
            
            {/* Content area */}
            <Collapse in={!isCollapsed} timeout={animated ? 300 : 0}>
              {component.children && component.children.length > 0 ? (
                component.children.map((child, index) => (
                  <ComponentPreview
                    key={child.id}
                    component={child}
                    onEdit={onEdit}
                    onToggleCollapse={onToggleCollapse}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onAddInside={onAddInside}
                    isFirst={index === 0}
                    isLast={index === component.children!.length - 1}
                    level={level + 1}
                    editMode={editMode}
                    isDragging={isDragging}
                    dropTarget={dropTarget}
                    handleContainerDragEnter={handleContainerDragEnter}
                    handleContainerDragOver={handleContainerDragOver}
                    handleContainerDragLeave={handleContainerDragLeave}
                    handleContainerDrop={handleContainerDrop}
                    onToggleVisibility={onToggleVisibility}
                    showWidgetName={showWidgetName}
                  />
                ))
              ) : (
                <Box
                  sx={{
                    p: 2,
                    border: editMode ? '1px dashed rgba(255, 255, 255, 0.2)' : 'none',
                    borderRadius: 1,
                    bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.1)' : 'transparent',
                    color: 'text.secondary',
                    textAlign: 'center',
                    minHeight: editMode ? '60px' : 'auto'
                  }}
                >
                  {isDragging ? 'Drop component here' : (editMode ? 'Drag and drop components here' : 'Content will appear here')}
                </Box>
              )}
            </Collapse>
          </Box>
        )
      }
      case 'Label':
        return (
          <Typography
            variant={(component.props.variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2') || 'body1'}
            noWrap={Boolean(component.props.noWrap)}
            sx={{
              fontWeight: component.props.fontWeight as number,
              fontStyle: component.props.fontStyle as 'italic' | 'normal',
              textDecoration: component.props.textDecoration as string,
              textAlign: component.props.textAlign as 'left' | 'center' | 'right' | 'justify',
              color: component.props.useCustomColor ? component.props.customColor as string : '#000',
              whiteSpace: component.props.noWrap ? 'nowrap' : 'normal',
              overflow: component.props.noWrap ? 'hidden' : 'visible',
              textOverflow: component.props.noWrap ? 'ellipsis' : 'clip',
            }}
          >
            {component.props.text as string}
          </Typography>
        )
      case 'Button': {
        const clickAction = component.props.clickAction as string | undefined;
        const toastMessage = (component.props.toastMessage as string) || 'Button clicked!';
        const toastSeverity = (component.props.toastSeverity as string) || 'info';
        const urlProp = component.props.url as string;
        // Determine alignment based on props.alignment
        const alignment = component.props.alignment as 'left' | 'center' | 'right' | undefined;
        const alignItems = alignment === 'right' ? 'flex-end' : alignment === 'center' ? 'center' : 'flex-start';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems }}>
            <Button
              variant={(component.props.variant as 'contained' | 'outlined' | 'text') || 'contained'}
              color={(component.props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info') || 'primary'}
              size={(component.props.size as 'small' | 'medium' | 'large') || 'medium'}
              fullWidth={Boolean(component.props.fullWidth)}
              disabled={Boolean(component.props.disabled)}
              onClick={() => {
                if (clickAction === 'toast') {
                  const customEvent = new CustomEvent('showWidgetToast', {
                    detail: {
                      message: toastMessage,
                      severity: toastSeverity
                    },
                    bubbles: true
                  });
                  document.dispatchEvent(customEvent);
                } else if (clickAction === 'openUrl' && urlProp) {
                  let url = urlProp;
                  if (url && !url.match(/^https?:\/\//)) {
                    url = `https://${url}`;
                  }
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
              sx={{
                fontWeight: component.props.fontWeight as number,
                fontStyle: component.props.fontStyle as string,
                textDecoration: component.props.textDecoration as string,
                textAlign: component.props.textAlign as 'left' | 'center' | 'right' | 'justify',
                ...(component.props.customColor ? {
                  backgroundColor: component.props.variant === 'contained' ? component.props.customColor : 'transparent',
                  borderColor: component.props.customColor,
                  color: component.props.variant === 'contained' ? '#fff' : component.props.customColor,
                  '&:hover': {
                    backgroundColor: component.props.variant === 'contained' 
                      ? component.props.customHoverColor || component.props.customColor 
                      : 'rgba(25, 118, 210, 0.04)',
                    borderColor: component.props.customHoverColor || component.props.customColor
                  }
                } : {}),
                ...(component.props.clickAction === 'openUrl' ? { 
                  '&::after': { 
                    content: '""',
                    display: 'inline-block',
                    width: '1em',
                    height: '1em',
                    marginLeft: '0.2em',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z\'/%3E%3C/svg%3E")',
                    backgroundSize: 'contain',
                    verticalAlign: 'middle',
                  } 
                } : {})
              }}
              startIcon={component.props.showStartIcon ? (() => {
                const iconName = component.props.iconName as string;
                switch (iconName) {
                  case 'add': return <AddIcon />;
                  case 'delete': return <DeleteIcon />;
                  case 'notification': return <NotificationsIcon />;
                  case 'code': return <CodeIcon />;
                  case 'settings': return <SettingsIcon />;
                  case 'preview': return <PreviewIcon />;
                  case 'openNew': return <OpenInNewIcon />;
                  case 'save': return <SaveIcon />;
                  case 'send': return <SendIcon />;
                  case 'upload': return <CloudUploadIcon />;
                  case 'check': return <CheckCircleIcon />;
                  default: return <AddIcon />;
                }
              })() : undefined}
              endIcon={component.props.showEndIcon ? (() => {
                const iconName = component.props.iconName as string;
                switch (iconName) {
                  case 'add': return <AddIcon />;
                  case 'delete': return <DeleteIcon />;
                  case 'notification': return <NotificationsIcon />;
                  case 'code': return <CodeIcon />;
                  case 'settings': return <SettingsIcon />;
                  case 'preview': return <PreviewIcon />;
                  case 'openNew': return <OpenInNewIcon />;
                  case 'save': return <SaveIcon />;
                  case 'send': return <SendIcon />;
                  case 'upload': return <CloudUploadIcon />;
                  case 'check': return <CheckCircleIcon />;
                  default: return <AddIcon />;
                }
              })() : undefined}
            >
              {component.props.text as string}
            </Button>
            {editMode && clickAction && (
              <>
                {clickAction === 'toast' && (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                    Click Action: Show toast "{toastMessage}" ({toastSeverity})
                  </Typography>
                )}
                {clickAction === 'openUrl' && urlProp && (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                    Click Action: Open URL {urlProp}
                  </Typography>
                )}
              </>
            )}
          </Box>
        )
      }
      case 'TextField':
        return (
          <TextField
            label={component.props.label as string}
            placeholder={component.props.placeholder as string}
            defaultValue={component.props.defaultValue as string}
            fullWidth
            size={(component.props.size as 'small' | 'medium') || 'small'}
            variant={(component.props.variant as 'outlined' | 'filled' | 'standard') || 'outlined'}
            required={Boolean(component.props.required)}
            disabled={Boolean(component.props.disabled)}
            error={Boolean(component.props.error)}
            helperText={
              component.props.error
                ? (component.props.errorText as string)
                : (component.props.helperText as string)
            }
            type={component.props.type as string}
            InputProps={{
              startAdornment: component.props.startAdornment && component.props.startAdornmentText ? (
                <InputAdornment position="start">{component.props.startAdornmentText as string}</InputAdornment>
              ) : undefined,
              endAdornment: component.props.endAdornment && component.props.endAdornmentText ? (
                <InputAdornment position="end">{component.props.endAdornmentText as string}</InputAdornment>
              ) : undefined
            }}
          />
        )
      case 'FlexBox': {
        const direction = (component.props.direction as 'row' | 'column' | 'row-reverse' | 'column-reverse') || 'row';
        const justifyContent = (component.props.justifyContent as string) || 'flex-start';
        const alignItems = (component.props.alignItems as string) || 'center';
        const flexWrap = (component.props.wrap as 'wrap' | 'nowrap' | 'wrap-reverse') || 'wrap';
        const spacing = (component.props.spacing as number) || 2;
        const padding = (component.props.padding as number) || 1;
        const useCustomColor = Boolean(component.props.useCustomColor);
        const backgroundColor = useCustomColor ? (component.props.backgroundColor as string || 'transparent') : 'transparent';
        
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: direction,
              justifyContent: justifyContent,
              alignItems: alignItems,
              flexWrap: flexWrap,
              gap: spacing,
              p: padding,
              border: isCurrentTarget || editMode ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              borderRadius: 1,
              minHeight: '50px',
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : backgroundColor,
              borderStyle: isCurrentTarget ? 'dashed' : 'solid',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((child, index) => (
                <ComponentPreview
                  key={child.id}
                  component={child}
                  onEdit={onEdit}
                  onToggleCollapse={onToggleCollapse}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onAddInside={onAddInside}
                  isFirst={index === 0}
                  isLast={index === component.children!.length - 1}
                  level={level + 1}
                  editMode={editMode}
                  isDragging={isDragging}
                  dropTarget={dropTarget}
                  handleContainerDragEnter={handleContainerDragEnter}
                  handleContainerDragOver={handleContainerDragOver}
                  handleContainerDragLeave={handleContainerDragLeave}
                  handleContainerDrop={handleContainerDrop}
                  onToggleVisibility={onToggleVisibility}
                  showWidgetName={showWidgetName}
                />
              ))
            ) : (
              <Box sx={{ 
                width: '100%', 
                textAlign: 'center', 
                color: 'text.secondary',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '40px'
              }}>
                {isDragging ? 'Drop component here' : 'Empty Flex Container'}
              </Box>
            )}
          </Box>
        )
      }
      case 'GridBox': {
        const columns = (component.props.columns as number) || 1;
        const cellPadding = (component.props.cellPadding as number) || 1;
        const spacing = (component.props.spacing as number) || 2;
        const useCustomColor = Boolean(component.props.useCustomColor);
        const backgroundColor = useCustomColor ? (component.props.backgroundColor as string) : 'transparent';
        const borderColor = useCustomColor ? (component.props.borderColor as string) : '#e0e0e0';
        
        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: spacing,
              p: cellPadding,
              border: isCurrentTarget || editMode ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              borderRadius: 1,
              minHeight: '50px',
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : backgroundColor,
              borderStyle: isCurrentTarget ? 'dashed' : 'solid',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((child, index) => (
                <Box
                  key={child.id}
                  sx={{
                    border: useCustomColor ? `1px solid ${borderColor}` : 'none',
                    borderRadius: 1,
                    p: cellPadding
                  }}
                >
                  <ComponentPreview
                    component={child}
                    onEdit={onEdit}
                    onToggleCollapse={onToggleCollapse}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onAddInside={onAddInside}
                    isFirst={index === 0}
                    isLast={index === (component.children?.length || 0) - 1}
                    level={level + 1}
                    editMode={editMode}
                    isDragging={isDragging}
                    dropTarget={dropTarget}
                    handleContainerDragEnter={handleContainerDragEnter}
                    handleContainerDragOver={handleContainerDragOver}
                    handleContainerDragLeave={handleContainerDragLeave}
                    handleContainerDrop={handleContainerDrop}
                    onToggleVisibility={onToggleVisibility}
                    showWidgetName={showWidgetName}
                  />
                </Box>
              ))
            ) : (
              <Box sx={{ 
                width: '100%', 
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center', 
                color: 'text.secondary',
                gridColumn: `span ${columns}`,
                minHeight: '40px'
              }}>
                {isDragging ? 'Drop component here' : 'Empty Grid Container'}
              </Box>
            )}
          </Box>
        )
      }
      case 'Chart': {
        const chartType = component.props.chartType as string || 'pie'
        const title = component.props.title as string || ''
        
        // Parse data for the preview from the actual component data
        let chartData: {
          labels: string[]
          datasets: Array<{
            label: string
            data: number[]
            backgroundColor?: string | string[]
          }>
        } = {
          labels: [],
          datasets: []
        }
        
        try {
          const dataString = component.props.data as string || '{}'
          if (dataString.trim().startsWith('<')) {
            // Basic XML parsing for demo purposes
            // In real app, would use proper XML parser
            // For now we'll skip XML in the preview
            chartData = {
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
              datasets: [{
                label: 'Sales',
                data: [30, 20, 15, 25, 10],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.8)',
                  'rgba(54, 162, 235, 0.8)',
                  'rgba(255, 206, 86, 0.8)',
                  'rgba(75, 192, 192, 0.8)',
                  'rgba(153, 102, 255, 0.8)'
                ]
              }]
            }
          } else if (dataString.trim()) {
            // Parse JSON data
            chartData = JSON.parse(dataString)
          } else {
            // Use default data if not provided
            chartData = {
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
              datasets: [{
                label: 'Sales',
                data: [30, 20, 15, 25, 10],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.8)',
                  'rgba(54, 162, 235, 0.8)',
                  'rgba(255, 206, 86, 0.8)',
                  'rgba(75, 192, 192, 0.8)',
                  'rgba(153, 102, 255, 0.8)'
                ]
              }]
            }
          }
        } catch (error) {
          console.error("Error parsing chart data:", error)
          // Use default data on error
          chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
              label: 'Sales',
              data: [30, 20, 15, 25, 10],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)'
              ]
            }]
          }
        }

        return (
          <Box sx={{ width: '100%' }}>
            <ChartPreview
              chartType={chartType}
              title={title}
              description={component.props.description as string}
              data={chartData}
            />
          </Box>
        )
      }
      default:
        return <Typography>Unknown component type: {component.type}</Typography>
    }
  }

  // If component is hidden and not in edit mode, don't render
  if (isHidden && !editMode) {
    return null;
  }

  // For non-container components, we can skip the Paper wrapper in non-edit mode
  const isContainer = ['FieldSet', 'FlexBox', 'GridBox'].includes(component.type);
  if (!editMode && !isContainer) {
    return renderComponent();
  }

  // Special case for FieldSet in non-edit mode - render directly without Paper wrapper
  if (!editMode && component.type === 'FieldSet') {
    return renderComponent();
  }

  return (
    <Paper
      elevation={editMode ? 1 : 0}
      sx={{
        position: 'relative',
        mb: 1,
        p: editMode ? 2 : 0,
        bgcolor: isCurrentTarget 
          ? 'rgba(0, 188, 162, 0.15)' 
          : (isHidden && editMode ? 'rgba(0, 0, 0, 0.3)' : (editMode ? 'background.paper' : 'transparent')),
        borderStyle: isCurrentTarget ? 'dashed' : 'solid',
        borderWidth: editMode ? 1 : 0,
        borderColor: isCurrentTarget 
          ? 'primary.main' 
          : (isHidden ? 'rgba(255, 0, 0, 0.4)' : 'divider'),
        opacity: isHidden && editMode ? 0.5 : 1,
        transition: 'background-color 0.3s, border-color 0.3s, opacity 0.3s',
        boxShadow: editMode ? 1 : 'none'
      }}
      onDragEnter={editMode ? (e) => handleContainerDragEnter(e, component.id) : undefined}
      onDragOver={editMode ? handleContainerDragOver : undefined}
      onDragLeave={editMode ? handleContainerDragLeave : undefined}
      onDrop={editMode ? (e) => handleContainerDrop(e, component.id) : undefined}
    >
      {/* Render the component controls in edit mode */}
      {editMode && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 4, 
            right: 4, 
            display: 'flex', 
            zIndex: 10,
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1
          }}
        >
          {/* Visibility toggle button */}
          <Tooltip title={isHidden ? "Show component" : "Hide component"}>
            <IconButton 
              size="small" 
              onClick={() => onToggleVisibility && onToggleVisibility(component.id)}
              sx={{ color: isHidden ? 'error.light' : 'success.light' }}
            >
              {isHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          <IconButton 
            size="small" 
            onClick={() => onEdit(component.id)}
            sx={{ color: 'info.light' }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          
          {!isFirst && (
            <IconButton 
              size="small" 
              onClick={() => onMoveUp(component.id)}
              sx={{ color: 'warning.light' }}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
          )}
          
          {!isLast && (
            <IconButton 
              size="small" 
              onClick={() => onMoveDown(component.id)}
              sx={{ color: 'warning.light' }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          )}
          
          <IconButton 
            size="small" 
            onClick={() => onDelete(component.id)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Component Type Label */}
      {editMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {ComponentIcon && (
            <Box component={ComponentIcon} sx={{ mr: 1, opacity: 0.7, fontSize: '1rem' }} />
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {component.type} {isHidden && "(Hidden)"}
          </Typography>
        </Box>
      )}

      {/* Actual component preview */}
      <Box sx={{ ml: editMode ? level * 2 : 0 }}>
        {renderComponent()}
      </Box>
    </Paper>
  )
}

export default ComponentPreview 