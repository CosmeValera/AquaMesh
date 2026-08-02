import tls from 'node:tls'

const socket = tls.connect(
  { host: 'api.v8.unrealspeech.com', port: 443, rejectUnauthorized: false, servername: 'api.v8.unrealspeech.com' },
  () => {
    let cert = socket.getPeerCertificate(true)
    const seen = new Set()
    while (cert && !seen.has(cert.fingerprint)) {
      seen.add(cert.fingerprint)
      console.log('subject:', JSON.stringify(cert.subject), '| issuer:', JSON.stringify(cert.issuer))
      cert = cert.issuerCertificate
    }
    socket.end()
  },
)
socket.on('error', (error) => {
  console.log('error', error.message)
})
