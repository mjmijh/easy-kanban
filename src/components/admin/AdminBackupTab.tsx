import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Database, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from '../../utils/toast';

interface DbInfo {
  size: number;
  lastModified: string;
  path: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const AdminBackupTab: React.FC = () => {
  const { t } = useTranslation('admin');
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDbInfo = async () => {
    try {
      setLoadingInfo(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/backup/info', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setDbInfo(data);
    } catch (e) {
      console.error('Failed to fetch DB info', e);
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    fetchDbInfo();
  }, []);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/backup/download', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Download failed');
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : 'kanban-backup.db';

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup downloaded', `File saved as ${filename}`);
    } catch (e: any) {
      toast.error('Backup failed', e.message || 'Could not download backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setRestoreConfirm(false);
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    try {
      setRestoring(true);
      const token = localStorage.getItem('authToken');

      const arrayBuffer = await selectedFile.arrayBuffer();

      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: arrayBuffer
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Restore failed');
      }

      toast.success('Restore successful', 'Please restart the Docker container now: docker compose restart kanban-app');
      setRestoreConfirm(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDbInfo();

    } catch (e: any) {
      toast.error('Restore failed', e.message || 'Could not restore backup');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Database size={22} />
          Backup & Restore
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Download a full backup of your database or restore from a previous backup file.
        </p>
      </div>

      {/* DB Info Card */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Current Database</p>
          {loadingInfo ? (
            <p className="text-xs text-gray-400 mt-1">Loading info...</p>
          ) : dbInfo ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Size: <span className="font-medium text-gray-700 dark:text-gray-200">{formatBytes(dbInfo.size)}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last modified: <span className="font-medium text-gray-700 dark:text-gray-200">
                  {new Date(dbInfo.lastModified).toLocaleString()}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-red-400 mt-1">Could not load database info</p>
          )}
        </div>
        <button
          onClick={fetchDbInfo}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loadingInfo ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Backup Section */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 space-y-3">
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Download size={18} />
          Download Backup
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Downloads the entire SQLite database as a <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">.db</code> file.
          This includes all boards, tasks, columns, relationships, users, and settings.
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {downloading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {downloading ? 'Preparing download...' : 'Download Backup'}
        </button>
      </div>

      {/* Restore Section */}
      <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-5 space-y-4">
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Upload size={18} />
          Restore from Backup
        </h3>

        <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300">
            <strong>Warning:</strong> Restoring will replace the current database with the uploaded file.
            All data created after the backup will be lost. After restore, you must login with the
            credentials that were valid at the time the backup was created.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select backup file (.db)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900/30 dark:file:text-blue-300
                hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50
                cursor-pointer"
            />
          </div>

          {selectedFile && !restoreConfirm && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={() => setRestoreConfirm(true)}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
              >
                Restore
              </button>
            </div>
          )}

          {restoreConfirm && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Are you absolutely sure? This will overwrite all current data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {restoring ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {restoring ? 'Restoring...' : 'Yes, restore now'}
                </button>
                <button
                  onClick={() => setRestoreConfirm(false)}
                  disabled={restoring}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBackupTab;
