import { ChildProcess, spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { createServer } from 'net'
import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'
import http from 'http'

let pythonProcess: ChildProcess | null = null
let backendPort = 0

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr !== 'string') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Could not find free port'))
      }
    })
    server.on('error', reject)
  })
}

function getPythonDir(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return join(process.cwd(), 'python')
  }
  return join(process.resourcesPath, 'python')
}

function getPythonBin(pythonDir: string): string {
  const isWin = process.platform === 'win32'

  // 1. Bundled portable runtime (production)
  if (isWin) {
    const bundled = join(pythonDir, 'python-runtime', 'python.exe')
    if (existsSync(bundled)) return bundled
  } else {
    const bundled = join(pythonDir, 'python-runtime', 'bin', 'python3')
    if (existsSync(bundled)) return bundled
  }

  // 2. Dev venv
  if (isWin) {
    const venvWin = join(pythonDir, '.venv', 'Scripts', 'python.exe')
    if (existsSync(venvWin)) return venvWin
  } else {
    const venvUnix = join(pythonDir, '.venv', 'bin', 'python3')
    if (existsSync(venvUnix)) return venvUnix
  }

  // 3. System fallback
  return isWin ? 'python' : 'python3'
}

function healthCheck(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.status === 'ok')
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

const execFileAsync = promisify(execFile)

async function ensureVenv(pythonDir: string): Promise<string> {
  const isWin = process.platform === 'win32'
  const venvDir = join(pythonDir, '.venv')
  const venvPython = isWin
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python3')

  if (!existsSync(venvPython)) {
    console.log('Creating Python virtual environment...')
    await execFileAsync('uv', ['venv', venvDir], { cwd: pythonDir })
  }

  // Always sync dependencies to handle missing or new packages
  console.log('Syncing Python dependencies...')
  const requirementsFile = join(pythonDir, 'requirements.txt')
  await execFileAsync('uv', ['pip', 'install', '-r', requirementsFile, '--python', venvPython], {
    cwd: pythonDir,
    timeout: 600000
  })

  return venvPython
}

export async function startPythonBackend(): Promise<number> {
  backendPort = await findFreePort()
  const pythonDir = getPythonDir()

  // In dev mode without a bundled runtime, ensure venv + deps are set up
  const isDev = !app.isPackaged
  const hasBundledRuntime = existsSync(join(pythonDir, 'python-runtime'))
  let pythonBin: string
  if (isDev && !hasBundledRuntime) {
    pythonBin = await ensureVenv(pythonDir)
  } else {
    pythonBin = getPythonBin(pythonDir)
  }

  console.log(`Starting Python backend on port ${backendPort}...`)
  console.log(`Python directory: ${pythonDir}`)
  console.log(`Python binary: ${pythonBin}`)

  // Build environment — sanitize PYTHONHOME/PYTHONPATH in production
  // to prevent interference from the user's system Python
  const env: Record<string, string | undefined> = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    VOICELAB_DATA_DIR: join(app.getPath('userData'), 'data')
  }

  if (app.isPackaged) {
    delete env.PYTHONHOME
    delete env.PYTHONPATH
    delete env.PYTHONSTARTUP
  }

  pythonProcess = spawn(pythonBin, ['server.py', '--port', String(backendPort)], {
    cwd: pythonDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env as NodeJS.ProcessEnv
  })

  pythonProcess.stdout?.on('data', (data) => {
    console.log(`[Python] ${data.toString().trim()}`)
  })

  pythonProcess.stderr?.on('data', (data) => {
    console.error(`[Python] ${data.toString().trim()}`)
  })

  pythonProcess.on('exit', (code) => {
    console.log(`Python process exited with code ${code}`)
    pythonProcess = null
  })

  // Wait for server to be ready (poll health endpoint)
  const maxAttempts = 60 // 30 seconds
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const healthy = await healthCheck(backendPort)
    if (healthy) {
      console.log('Python backend is ready!')
      return backendPort
    }
  }

  throw new Error('Python backend failed to start within 30 seconds')
}

export function stopPythonBackend(): void {
  if (pythonProcess) {
    console.log('Stopping Python backend...')
    const isWin = process.platform === 'win32'

    if (isWin) {
      // Windows: use taskkill for clean shutdown
      spawn('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'])
    } else {
      pythonProcess.kill('SIGTERM')
    }

    setTimeout(() => {
      if (pythonProcess) {
        if (!isWin) {
          pythonProcess.kill('SIGKILL')
        }
        pythonProcess = null
      }
    }, 3000)
  }
}

export function getBackendPort(): number {
  return backendPort
}
