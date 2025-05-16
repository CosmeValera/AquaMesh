import React from 'react'
import './status.scss'
import { ReactComponent as Logo } from '../../public/logo.svg'

interface ErrorMessageProps {
  icon: string;
  message?: string;
  subMessage?: string;
  height: string;
}

interface LoadingMessageProps {
  componentLine?: string;
  urlLine?: string;
  height: string;
}

interface StatusPageProps {
  componentLine?: string;
  urlLine?: string;
  status: Status;
}
export type Status = 'loading' | 'loading_Main' | 'error' | 'error_Main' | 'unauth' | 'default'

const ErrorMessage: React.FC<ErrorMessageProps> = ({ icon, message, subMessage, height }) => (
  <div className={`centered ${height}`}>
    <i className={`icon-error pi ${icon}`}></i>
    {message && <h3>{message}</h3>}
    {subMessage && <p>{subMessage}</p>}
  </div>
)

const LoadingMessage: React.FC<LoadingMessageProps> = ({ componentLine, urlLine, height }) => (
  <div className={`centered loader ${height}`}>
    <Logo height={componentLine ? '5hw' : '20dvh'} width={componentLine ? '5vw' : '20vw'} />
    {componentLine && <p>Loading {componentLine} from {urlLine}</p>}
  </div>
)

export const StatusPage: React.FC<StatusPageProps> = ({ componentLine, urlLine, status }) => {
  switch (status) {
  case 'loading':
    return <LoadingMessage componentLine={componentLine} urlLine={urlLine} height={'h-full'}/>
  case 'loading_Main':
    return <LoadingMessage componentLine={componentLine} urlLine={urlLine} height={'h-screen'}/>
  case 'error':
    return <ErrorMessage icon="pi-exclamation-circle" message={componentLine} subMessage={urlLine} height={'h-full'} />
  case 'error_Main':
    return <ErrorMessage icon="pi-exclamation-circle" message={componentLine} subMessage={urlLine} height={'h-screen'} />
  case 'unauth':
    return <ErrorMessage icon="pi-lock" message={componentLine} subMessage={urlLine} height={'h-full'}/>
  default:
    return <ErrorMessage icon="pi-exclamation-circle" message={componentLine} subMessage={urlLine} height={'h-full'}/>
  }
}

export default StatusPage
