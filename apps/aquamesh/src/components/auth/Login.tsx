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
  SelectChangeEvent
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { ReactComponent as Logo } from '../../../public/logo.svg'

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
  const [selectedUser, setSelectedUser] = useState('admin')
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
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
              AquaMesh
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Please select a user to continue
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              User
            </Typography>
            <Select
              value={selectedUser}
              onChange={handleUserChange}
              fullWidth
            >
              <MenuItem value="admin">{userOptions.admin.name} ({userOptions.admin.role})</MenuItem>
              <MenuItem value="operator">{userOptions.operator.name} ({userOptions.operator.role})</MenuItem>
              <MenuItem value="viewer">{userOptions.viewer.name} ({userOptions.viewer.role})</MenuItem>
            </Select>
          </FormControl>

          <Button 
            variant="contained" 
            fullWidth 
            size="large"
            onClick={handleLogin}
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </CardContent>
      </Card>
    </Container>
  )
}

export default Login 