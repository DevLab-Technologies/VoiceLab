import axios from 'axios'
import type { ModelInfo, ModelId } from '../types/model'
import { getBaseURL } from './client'

function getClient() {
  return axios.create({ baseURL: `${getBaseURL()}/api`, timeout: 600000 })
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await getClient().get('/models')
  return res.data
}

export async function getModelStatus(modelId: ModelId): Promise<ModelInfo> {
  const res = await getClient().get(`/models/${modelId}/status`)
  return res.data
}

export async function downloadModel(modelId: ModelId): Promise<{ status: string }> {
  const res = await getClient().post(`/models/${modelId}/download`)
  return res.data
}

export async function deleteModel(modelId: ModelId): Promise<void> {
  await getClient().delete(`/models/${modelId}`)
}
