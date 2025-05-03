import React from 'react'
import { Box, Typography, Paper } from '@mui/material'

interface ChartPreviewProps {
  chartType: string
  title?: string
  height?: number // Make height optional as we'll use a fixed value
  description?: string
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
    }>
  }
}

const ChartPreview: React.FC<ChartPreviewProps> = ({
  chartType,
  title,
  description,
  data
}) => {
  const chartTitle = String(title || '')
  const chartDescription = String(description || '')
  const FIXED_HEIGHT = 400
  
  // Generate colors for the pie segments and legend - consistent colors for both
  const colors = React.useMemo(() => {
    const baseColors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)',
      'rgba(83, 102, 255, 0.8)',
      'rgba(178, 102, 255, 0.8)',
      'rgba(255, 102, 130, 0.8)'
    ]

    // Handle case where data is incomplete or malformed
    if (!data?.datasets?.[0] || !data?.labels?.length) {
      return baseColors.slice(0, 5)
    }

    // If data comes with backgroundColor, use that instead
    if (data.datasets[0]?.backgroundColor) {
      if (Array.isArray(data.datasets[0].backgroundColor)) {
        return data.datasets[0].backgroundColor
      }
      // If it's a single color, repeat it for all slices
      return Array(data.labels.length).fill(data.datasets[0].backgroundColor)
    }

    // Otherwise generate colors from our base palette
    const colorLen = baseColors.length
    const totalLabels = data.labels.length
    return Array(totalLabels).fill(0).map((_, i) => baseColors[i % colorLen])
  }, [data])

  // Calculate percentages for pie chart segments
  const segments = React.useMemo(() => {
    // Handle case where data is incomplete or malformed
    if (!data?.datasets?.[0]?.data?.length || !data?.labels?.length) {
      return []
    }
    
    const values = data.datasets[0].data
    const total = values.reduce((a, b) => a + b, 0)
    
    // If total is zero, return empty segments to avoid dividing by zero
    if (total === 0) {
      return []
    }
    
    // First pass: calculate percentages
    let segments = values.map((value, index) => {
      const percentage = (value / total) * 100
      return { 
        value, 
        percentage,
        startDegree: 0,
        endDegree: 0,
        color: colors[index] || colors[0], // Fallback to first color if index out of bounds
        label: data.labels[index] || `Item ${index + 1}` // Fallback label
      }
    })
    
    // Second pass: calculate start and end degrees
    let currentDegree = 0
    segments = segments.map(segment => {
      const segmentDegrees = (segment.percentage / 100) * 360
      const startDegree = currentDegree
      const endDegree = currentDegree + segmentDegrees
      currentDegree = endDegree
      return {
        ...segment,
        startDegree,
        endDegree
      }
    })
    
    return segments
  }, [data, colors])

  // Log the chart type for debugging but always render pie
  React.useEffect(() => {
    console.log(`Rendering chart of type: ${chartType || 'pie'}`)
  }, [chartType])
  
  // Render pie chart
  const renderPieChart = () => {
    if (!segments || segments.length === 0) {
      // Show placeholder if no valid data is available
      return (
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}>
          <Box sx={{
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            position: 'relative',
            aspectRatio: '1/1',
            background: 'rgba(200, 200, 200, 0.2)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="body2" color="text.secondary">
              No data available
            </Typography>
          </Box>
        </Box>
      )
    }

    // Generate CSS for conic-gradient based on calculated segments
    const conicGradient = `conic-gradient(${
      segments.map(segment => 
        `${segment.color} ${segment.startDegree}deg ${segment.endDegree}deg`
      ).join(', ')
    })`

    return (
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%'
      }}>
        <Box sx={{
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          position: 'relative',
          aspectRatio: '1/1',
          background: conicGradient,
          boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          '&::before': {
            content: '""',
            display: 'block',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            backgroundColor: 'white',
            position: 'absolute',
            top: '25%',
            left: '25%',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)',
          }
        }} />
        
        {/* Legend */}
        <Box sx={{ 
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '280px',
          width: '100%',
          marginTop: 2,
          gap: 1
        }}>
          {segments.map((segment, index) => (
            <Box 
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.04)',
              }}
            >
              <Box sx={{
                width: 12,
                height: 12,
                borderRadius: '3px',
                backgroundColor: segment.color,
                marginRight: 1
              }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}
              >
                {segment.label} ({segment.value})
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        sx={{
          p: 2,
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 1,
          height: `${FIXED_HEIGHT}px`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Title inside the paper component */}
        {chartTitle && (
          <Typography variant="subtitle1" sx={{ mb: 2, alignSelf: 'flex-start' }}>
            {chartTitle}
          </Typography>
        )}
        {renderPieChart()}
      </Paper>
      
      {chartDescription && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
          {chartDescription}
        </Typography>
      )}
    </Box>
  )
}

export default ChartPreview 