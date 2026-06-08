const { spawn } = require('node:child_process')

const port = process.env.PORT
const parsedPort = Number(port)

if (
  !port ||
  !Number.isInteger(parsedPort) ||
  parsedPort < 0 ||
  parsedPort >= 65536
) {
  console.error(`Missing or invalid PORT from Vercel dev: ${port || '<empty>'}`)
  process.exit(1)
}

const child = spawn(
  process.execPath,
  [
    require.resolve('webpack-cli/bin/cli.js'),
    'serve',
    '--mode',
    'development',
    '--host',
    '0.0.0.0',
    '--port',
    String(parsedPort),
  ],
  {
    stdio: 'inherit',
    env: process.env,
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
