const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

export const api = {
  get: (url) =>
    fetch(url, { headers: getAuthHeaders() }).then((r) => {
      if (r.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return r
    }),
  post: (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return r
    }),
  put: (url, body) =>
    fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return r
    }),
  patch: (url, body) =>
    fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return r
    }),
}
