import axios from 'axios'
import { getBaseURL } from './client'

function getClient() {
  return axios.create({ baseURL: `${getBaseURL()}/api`, timeout: 30000 })
}

export interface VideoInfo {
  title: string
  duration: number
  channel: string
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const res = await getClient().post('/youtube/info', { url })
  return res.data
}

export async function extractAudio(
  url: string,
  info: VideoInfo,
  startSec?: number,
  endSec?: number,
  signal?: AbortSignal
): Promise<{ audioBlob: Blob; title: string; duration: number }> {
  const res = await getClient().post(
    '/youtube/extract-audio',
    {
      url,
      title: info.title,
      duration: info.duration,
      start_sec: startSec ?? null,
      end_sec: endSec ?? null,
    },
    {
      responseType: 'blob',
      timeout: 120000,
      signal,
    }
  )

  const title = decodeURIComponent(res.headers['x-video-title'] || info.title)
  const duration = parseInt(res.headers['x-video-duration'] || '0', 10) || info.duration

  return {
    audioBlob: new Blob([res.data], { type: 'audio/wav' }),
    title,
    duration,
  }
}
