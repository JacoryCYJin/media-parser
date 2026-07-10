const commonHeaders = {}

const normalizeHeaders = (headers = {}) => {
  const normalized = {}

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value)
    }
  })

  return normalized
}

const createAxiosLikeError = (method, path, response) => {
  const message = response?.data?.error || response?.data?.message || `Request failed with status ${response?.status || 0}`
  const error = new Error(message)

  error.config = { method, url: path }
  error.response = {
    status: response?.status || 0,
    data: response?.data
  }

  return error
}

const request = async ({ method = 'GET', url, data, params, headers } = {}) => {
  const response = await window.mediaParser.request({
    method,
    path: url,
    data,
    params,
    headers: {
      ...normalizeHeaders(commonHeaders),
      ...normalizeHeaders(headers)
    }
  })

  if (!response.ok) {
    throw createAxiosLikeError(method, url, response)
  }

  return {
    data: response.data,
    status: response.status,
    headers: {},
    config: { method, url }
  }
}

const apiClient = {
  defaults: {
    headers: {
      common: commonHeaders
    }
  },
  request,
  get: (url, config = {}) => request({ ...config, method: 'GET', url }),
  post: (url, data, config = {}) => request({ ...config, method: 'POST', url, data }),
  delete: (url, config = {}) => request({ ...config, method: 'DELETE', url })
}

export default apiClient
