import React from 'react'
import { AppBar, Avatar, Box, Button, Toolbar, Typography } from '@mui/material'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { useNavigate } from 'react-router-dom'

import { useResponsiveWorkspaceMode } from '../workspace/useResponsiveWorkspaceMode'
import { useInterfaceText } from '../../language/interfaceLanguage'

/**
 * The demo's chrome. It copies TopNavBar's shell so /try looks exactly like the
 * app, but deliberately shares none of its right side: that is all account
 * machinery (sign out, profile deletion, the `userData` write, Carrot packs)
 * which is meaningless logged out and would touch a real account's local state.
 *
 * The identity is static text on purpose. A menu-less "Guest" is the honest
 * signal that there is no account behind this session.
 */
const DemoTopNavBar: React.FC = () => {
  const { t } = useInterfaceText()
  const navigate = useNavigate()
  const {
    isPhone,
    isTablet,
    isDesktopWorkspace: isDesktop,
    isPhoneOrTablet: isMobileWorkspaceHeader,
  } = useResponsiveWorkspaceMode()

  const goHome = () => navigate('/')

  const logIn = (
    <Button
      variant="outlined"
      onClick={() => navigate('/login')}
      data-testid="demo-log-in"
      sx={{
        height: isPhone || isTablet ? 32 : 34,
        px: isPhone || isTablet ? 1.25 : 1.75,
        flex: '0 0 auto',
        borderRadius: 999,
        textTransform: 'none',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        color: 'foreground.contrastPrimary',
        borderColor: (theme) =>
          theme.palette.mode === 'light'
            ? 'rgba(0,137,123,0.38)'
            : 'rgba(255,255,255,0.4)',
        '&:hover': {
          borderColor: (theme) =>
            theme.palette.mode === 'light'
              ? 'rgba(0,137,123,0.62)'
              : 'rgba(255,255,255,0.7)',
          bgcolor: (theme) =>
            theme.palette.mode === 'light'
              ? 'rgba(0,137,123,0.13)'
              : 'rgba(255,255,255,0.18)',
        },
      }}
    >
      {t('demo.logIn')}
    </Button>
  )

  const guestIdentity = (
    <Box
      data-testid="demo-guest-identity"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobileWorkspaceHeader ? 0 : 1,
        flexDirection: isPhone || isTablet ? 'column' : 'row',
        flex: '0 0 auto',
        color: 'foreground.contrastPrimary',
        px: isPhone || isTablet ? 0.5 : 1,
      }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: 'primary.main',
          fontSize: '0.9rem',
        }}
      >
        <PersonOutlineIcon fontSize="small" />
      </Avatar>
      {isPhone || isTablet ? (
        <Typography
          variant="caption"
          sx={{ fontSize: '0.6rem', mt: 0.3, lineHeight: 1 }}
        >
          {t('demo.guest')}
        </Typography>
      ) : (
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
            {t('demo.guest')}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
            {t('demo.guestSubtitle')}
          </Typography>
        </Box>
      )}
    </Box>
  )

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: 'background.header',
        boxShadow: 'none',
        borderBottom: 1,
        borderColor: 'divider',
        height: isMobileWorkspaceHeader ? '56px' : '52px',
      }}
    >
      <Toolbar
        sx={{
          minHeight: isMobileWorkspaceHeader ? '56px' : '52px',
          height: isMobileWorkspaceHeader ? '56px' : '52px',
          boxSizing: 'border-box',
          alignItems: 'center',
          py: 0,
          px: isMobileWorkspaceHeader ? 0.75 : 1.25,
          gap: isMobileWorkspaceHeader ? 0.75 : 0,
          '& .MuiTypography-root': {
            lineHeight: 1.15,
          },
          '@media (min-width:600px)': {
            minHeight: isMobileWorkspaceHeader ? '56px' : '52px',
            height: isMobileWorkspaceHeader ? '56px' : '52px',
          },
        }}
      >
        <Box
          aria-label="RabbitHole logo"
          role="button"
          tabIndex={0}
          onClick={goHome}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              goHome()
            }
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobileWorkspaceHeader ? 1.1 : 0,
            flex: isMobileWorkspaceHeader ? 1 : '0 0 auto',
            minWidth: 0,
            fontWeight: isDesktop ? 'bold' : 'normal',
            mr: isMobileWorkspaceHeader ? 0 : isDesktop ? 1.25 : 0.5,
            color: 'foreground.contrastPrimary',
            px: 0,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          <Box
            data-testid="logo"
            component="img"
            src="/logo.png"
            alt=""
            sx={{
              width: isMobileWorkspaceHeader ? 30 : isDesktop ? 30 : 28,
              height: isMobileWorkspaceHeader ? 30 : isDesktop ? 30 : 28,
              display: 'block',
              mr: isMobileWorkspaceHeader || !isDesktop ? 0 : 1.35,
            }}
          />
          {isMobileWorkspaceHeader ? (
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              RabbitHole
            </Typography>
          ) : (
            isDesktop && 'RabbitHole'
          )}
        </Box>

        {isMobileWorkspaceHeader ? null : (
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }} />
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: isPhone ? 1.5 : 1,
            flex: '0 0 auto',
          }}
        >
          {logIn}
          {guestIdentity}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default DemoTopNavBar
