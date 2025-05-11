import React, { useState, useEffect } from 'react'
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Container,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { ReactComponent as Logo } from '../../../public/logo.svg'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
// Define user type for localStorage
interface UserData {
  id: string
  name: string
  role: string
}

const userOptions: Record<string, UserData> = {
  admin: { id: 'admin', name: 'Admin', role: 'ADMIN_ROLE' },
  operator: { id: 'operator', name: 'Operator', role: 'OPERATOR_ROLE' },
  viewer: { id: 'viewer', name: 'Viewer', role: 'VIEWER_ROLE' }
}

const Login: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState('viewer')
  const navigate = useNavigate()

  // Load the last selected user from localStorage if available
  useEffect(() => {
    const savedUser = localStorage.getItem('selectedUser')
    if (savedUser && userOptions[savedUser]) {
      setSelectedUser(savedUser)
    }
  }, [])

  const handleUserChange = (event: SelectChangeEvent) => {
    const userId = event.target.value
    setSelectedUser(userId)
    
    // Save user ID to localStorage
    localStorage.setItem('selectedUser', userId)
  }

  const handleLogin = () => {
    // Save full user data to localStorage
    const userData = userOptions[selectedUser]
    localStorage.setItem('userData', JSON.stringify(userData))
    
    // Navigate back to the main dashboard
    navigate('/')
  }

  return (
    <Container 
      maxWidth={false} 
      sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'background.default'
      }}
    >
      <Card 
        sx={{ 
          maxWidth: 400, 
          width: '100%',
          boxShadow: 3,
          bgcolor: 'background.paper'
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Logo height="64px" width="64px" style={{ marginBottom: '16px' }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1, color: 'white' }}>
              AquaMesh
            </Typography>
            <Typography variant="body2" sx={{ color: 'white' }}>
              Please select a user to continue
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'white' }}>
              User
            </Typography>
            <Select
              value={selectedUser}
              onChange={handleUserChange}
              fullWidth
              sx={{ 
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                },
                '& .MuiSvgIcon-root': {
                  color: 'white',
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'background.paper',
                    '& .MuiMenuItem-root': {
                      color: 'white',
                    }
                  }
                }
              }}
            >
              <MenuItem value="admin">{userOptions.admin.name} ({userOptions.admin.role})</MenuItem>
              <MenuItem value="operator">{userOptions.operator.name} ({userOptions.operator.role})</MenuItem>
              <MenuItem value="viewer">{userOptions.viewer.name} ({userOptions.viewer.role})</MenuItem>
            </Select>
          </FormControl>

          {/* { selectedUser !== 'admin' && ( */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              mb: 3, 
              border: selectedUser === 'admin'
                ? '1px solid rgb(36, 232, 36)'
                : '1px solid rgba(255, 193, 7, 0.5)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              background: selectedUser === 'admin'
                ? 'rgb(36, 232, 36, 0.3)'
                : 'rgba(255, 193, 7, 0.3)'
            }}
          >
            { selectedUser === 'admin' && (
            // Icon for admin of checkmark
              <CheckCircleIcon 
                fontSize="small" 
                sx={{ 
                  color: 'rgb(36, 232, 36)', 
                  mr: 1.5, 
                  mt: 0.3 
                }} 
              />
            )}

            {selectedUser !== 'admin' && (
              <InfoIcon 
                fontSize="small" 
                sx={{ 
                  color: '#FFC107', 
                  mr: 1.5, 
                  mt: 0.3 
                }} 
              />
            )}
            <Typography 
              variant="body2" 
              color="white"
              sx={{
                ...(selectedUser !== 'admin' && {
                  '& strong': {
                    background: 'linear-gradient(90deg, #FFC107, #FF9800)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
                  }
                }),
                ...(selectedUser === 'admin' && {
                  '& strong': {
                    color: 'rgb(36, 232, 36)'
                  }
                })
              }}
            >
              {selectedUser === 'admin' ? (
                <span>
                  Great choice! <strong>Admins</strong> get full access, including the <strong>Widget Editor</strong>, creating templates and editing dashboards.
                </span>
              ) : (
                <span>
                  For full access to all features like the Widget Editor, select the <strong>Admin</strong> role. Viewers and Operators only have read-only access.
                </span>
              )}
            </Typography>
          </Paper>
          {/* )} */}

          <Button 
            variant="contained" 
            fullWidth 
            size="large"
            onClick={handleLogin}
            sx={{ 
              mt: 2,
              color: 'white'
            }}
          >
            Login
          </Button>
        </CardContent>
      </Card>
    </Container>
  )
}

export default Login 