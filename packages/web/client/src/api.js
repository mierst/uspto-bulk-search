const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
  }
  return res;
}

function jsonPost(url, data) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());
}

function jsonPut(url, data) {
  return request(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());
}

export const api = {
  // Search
  searchUSPTO: (query, options = {}) => {
    const params = new URLSearchParams({ q: query, ...options });
    return request(`${API}/search?${params}`).then(r => r.json());
  },
  getCaseStatus: (caseId) => request(`${API}/search/case/${caseId}/status`).then(r => r.json()),

  // Projects
  createProject: (name, searchTerms) => jsonPost(`${API}/projects`, { name, searchTerms }),
  findOrCreateProject: (name, searchTerms) => jsonPost(`${API}/projects/find-or-create`, { name, searchTerms }),
  listProjects: () => request(`${API}/projects`).then(r => r.json()),
  getProject: (id) => request(`${API}/projects/${id}`).then(r => r.json()),
  deleteProject: (id) => request(`${API}/projects/${id}`, { method: 'DELETE' }).then(r => r.json()),
  renameProject: (id, newName) => jsonPut(`${API}/projects/${id}`, { name: newName }),

  // Assignments
  getAssignments: (projectId) => request(`${API}/assignments/${projectId}`).then(r => r.json()),
  saveAssignment: (projectId, data) => jsonPost(`${API}/assignments/${projectId}`, data),
  getAssignmentProjects: (serialNumber) => request(`${API}/assignments/by-serial/${serialNumber}`).then(r => r.json()),

  // Local search
  localSearch: (query) => request(`${API}/search/local?q=${encodeURIComponent(query)}`).then(r => r.json()),

  // Files
  listFiles: (projectId) => request(`${API}/files/${projectId}`).then(r => r.json()),
  deleteFile: (fileId) => request(`${API}/files/${fileId}`, { method: 'DELETE' }).then(r => r.json()),
  getStorageStats: () => request(`${API}/files/stats`).then(r => r.json()),
  downloadFile: (url, projectId) => jsonPost(`${API}/files`, { url, projectId }),

  // Export
  exportExhibit: async (assignmentIds, projectId) => {
    const res = await request(`${API}/export/exhibit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentIds, projectId }),
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chain-of-title.pdf';
    a.click();
    URL.revokeObjectURL(a.href);
    return { success: true };
  },

  // Settings
  getSettings: () => request(`${API}/settings`).then(r => r.json()),
  setSettings: (settings) => jsonPut(`${API}/settings`, settings),

  // Auth — getMe uses fetch directly to avoid 401 redirect loop
  getMe: async () => {
    const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },
  logout: () => request(`${API}/auth/logout`, { method: 'POST' }),

  // External links (just window.open in web)
  openExternal: (url) => window.open(url, '_blank'),

  // Batch search with SSE streaming from POST
  batchSearch: async (marks, onProgress) => {
    const res = await fetch(`${API}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ marks }),
    });

    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || 'Batch search failed');
    }

    // Read SSE stream from the POST response body
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (onProgress) onProgress(data);
          } catch (e) {
            // skip malformed events
          }
        }
      }
    }
  },
};
