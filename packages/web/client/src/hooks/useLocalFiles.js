import { useState, useCallback } from 'react';
import { api } from '../api';

export function useLocalFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const data = await api.listFiles(projectId);
      setFiles(data || []);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFile = useCallback(async (fileId) => {
    try {
      await api.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }, []);

  return { files, loading, loadFiles, deleteFile };
}
