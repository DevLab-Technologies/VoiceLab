import axios from 'axios'

let baseURL = 'http://127.0.0.1:18923'

export async function initApiClient(): Promise<void> {
  try {
    const port = await window.api.getBackendPort()
    if (port) {
      baseURL = `http://127.0.0.1:${port}`
    }
  } catch {
    // Fallback to default port
  }
}

export const apiClient = new Proxy(
  {},
  {
    get(_, prop) {
      const instance = axios.create({
        baseURL: `${baseURL}/api`,
        timeout: 120000
      })
      return (instance as any)[prop]
    }
  }
) as ReturnType<typeof axios.create>

export function getAudioUrl(type: 'profiles' | 'generations', id: string, filename: string): string {
  return `${baseURL}/api/audio/${type}/${id}/${filename}`
}

export function getBaseURL(): string {
  return baseURL
}
