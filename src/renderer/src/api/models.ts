import type { ModelInfo, ModelId } from '../types/model'
import { apiClient } from './client'

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await apiClient.get('/models')
  return res.data
}

export async function getModelStatus(modelId: ModelId): Promise<ModelInfo> {
  const res = await apiClient.get(`/models/${modelId}/status`)
  return res.data
}

export async function downloadModel(modelId: ModelId): Promise<{ status: string }> {
  const res = await apiClient.post(`/models/${modelId}/download`, {}, { timeout: 0 })
  return res.data
}

export async function deleteModel(modelId: ModelId): Promise<void> {
  await apiClient.delete(`/models/${modelId}`)
}
