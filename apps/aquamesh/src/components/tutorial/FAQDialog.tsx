import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';

interface FAQDialogProps {
  open: boolean;
  onClose: () => void;
}

// FAQ data structure
interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const FAQDialog: React.FC<FAQDialogProps> = ({ open, onClose }) => {
  const theme = useTheme();

  // FAQ data organized by categories
  const faqs: FAQ[] = [
    // General FAQs
    {
      category: 'General',
      question: 'What is AquaMesh?',
      answer: 'AquaMesh is a customizable dashboard platform that allows you to create, organize, and visualize widgets in a flexible layout. It provides tools for dashboard management and widget creation.'
    },
    {
      category: 'General',
      question: 'How do I get started?',
      answer: 'Start by exploring the tutorial (click the question mark icon in the top bar). You can then either use predefined dashboards and widgets, or create your own custom widgets using the Widget Editor.'
    },
    {
      category: 'General',
      question: 'Can I save my dashboards?',
      answer: 'Yes! You can save your dashboards by clicking on the Dashboard menu and selecting "Save Dashboard". You can also make them public or private, add tags, and provide descriptions.'
    },
    
    // Dashboard FAQs
    {
      category: 'Dashboards',
      question: 'How do I create a new dashboard?',
      answer: 'Click on the Dashboard menu in the top bar and select "New Dashboard". You can also click the + button in the dashboard tabs area.'
    },
    {
      category: 'Dashboards',
      question: 'How do I add widgets to my dashboard?',
      answer: 'Click on the Widgets menu in the top bar and select from the available widgets. The widget will be added to your current dashboard.'
    },
    {
      category: 'Dashboards',
      question: 'How do I arrange widgets on my dashboard?',
      answer: 'You can drag and drop widgets to rearrange them. You can also resize widgets by dragging their edges or corners.'
    },
    {
      category: 'Dashboards',
      question: 'Can I share my dashboards with others?',
      answer: 'Yes, you can make dashboards public by toggling the visibility in the Dashboard Library. Public dashboards are visible to all users.'
    },
    
    // Widget Editor FAQs
    {
      category: 'Widget Editor',
      question: 'What is the Widget Editor?',
      answer: 'The Widget Editor is a tool that allows you to create custom widgets by combining various UI components. You can drag and drop components, configure their properties, and save your widgets for later use.'
    },
    {
      category: 'Widget Editor',
      question: 'How do I create a new widget?',
      answer: 'Click on the Widget Editor button in the top bar. This will open the editor where you can drag components from the left panel onto the canvas. Once you\'ve designed your widget, click Save to add it to your widget library.'
    },
    {
      category: 'Widget Editor',
      question: 'Can I edit existing widgets?',
      answer: 'Yes, you can edit any widgets you\'ve created. Click on the Widgets menu, then select "Manage Widgets". From there, you can find your widget and click the edit button.'
    },
    {
      category: 'Widget Editor',
      question: 'What components are available in the Widget Editor?',
      answer: 'The Widget Editor provides various UI components like buttons, text fields, switches, charts, and layout components like fieldsets and grids. You can combine these to create complex widgets.'
    },
    
    // Troubleshooting FAQs
    {
      category: 'Troubleshooting',
      question: 'My changes aren\'t saving. What should I do?',
      answer: 'Make sure you click the Save button after making changes to a widget or dashboard. Changes are only stored when explicitly saved.'
    },
    {
      category: 'Troubleshooting',
      question: 'How do I restore a previous version of a widget?',
      answer: 'In the Widget Editor, click on the version history button in the toolbar. This will show you all saved versions of the current widget, and you can restore any previous version.'
    },
    {
      category: 'Troubleshooting',
      question: 'Can I import or export widgets?',
      answer: 'Yes, the Widget Editor includes import/export functionality. You can export widgets as JSON files and import them later, which is useful for backup or sharing with others.'
    }
  ];

  // Get unique categories
  const categories = Array.from(new Set(faqs.map(faq => faq.category)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: '#00A389',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#00BC9A', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box display="flex" alignItems="center">
          <QuestionAnswerIcon sx={{ mr: 1, color: '#191919' }} />
          <Typography variant="h6" component="div" fontWeight="bold" color="#191919">
            Frequently Asked Questions
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="close"
          sx={{ color: '#191919' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, bgcolor: '#00A389' }}>
        <Typography variant="body1" color="white" paragraph>
          Find answers to common questions about AquaMesh, dashboards, widgets, and more.
        </Typography>
        
        {categories.map((category, index) => (
          <Box key={category} sx={{ mt: index > 0 ? 3 : 0 }}>
            <Typography 
              variant="h6" 
              color="white" 
              sx={{ 
                mb: 1,
                pb: 1,
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              {category}
            </Typography>
            
            {faqs.filter(faq => faq.category === category).map((faq, i) => (
              <Accordion 
                key={i} 
                sx={{ 
                  mb: 1,
                  bgcolor: 'rgba(0, 0, 0, 0.1)',
                  color: 'white',
                  '&.Mui-expanded': {
                    margin: '0 0 8px 0',
                  },
                  '&:before': {
                    display: 'none',
                  },
                  borderLeft: '3px solid rgba(255, 255, 255, 0.3)',
                  '&:hover': {
                    borderLeft: '3px solid white'
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
                  aria-controls={`panel${i}-content`}
                  id={`panel${i}-header`}
                >
                  <Typography fontWeight="medium">{faq.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', mb: 1.5 }} />
                  <Typography>{faq.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ))}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389' }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          sx={{ 
            bgcolor: '#00D1AB',
            color: '#191919',
            '&:hover': {
              bgcolor: '#00E4BC',
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FAQDialog; 