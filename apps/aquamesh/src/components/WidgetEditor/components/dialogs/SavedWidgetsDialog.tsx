import React from 'react'
import { CustomWidget } from '../../WidgetStorage'
import WidgetManagementModal from './WidgetManagementModal'

interface SavedWidgetsDialogProps {
  open: boolean
  widgets: CustomWidget[]
  onClose: () => void
  onLoad: (widget: CustomWidget, editMode?: boolean) => void
  onDelete: (id: string) => void
}

// Wrapper component that reuses WidgetManagementModal for consistency
const SavedWidgetsDialog: React.FC<SavedWidgetsDialogProps> = ({
  open,
  widgets,
  onClose,
  onLoad,
  onDelete,
}) => {
  // Handler for preview (load in view mode)
  const handlePreview = (widget: CustomWidget) => {
    onLoad(widget, false) // false = view mode
  }
  
  // Handler for edit (load in edit mode)
  const handleEdit = (widget: CustomWidget) => {
    onLoad(widget, true) // true = edit mode
  }
  
  return (
    <WidgetManagementModal
      open={open}
      onClose={onClose}
      widgets={widgets}
      onPreview={handlePreview}
      onEdit={handleEdit}
      onDelete={onDelete}
    />
  )
}

export default SavedWidgetsDialog