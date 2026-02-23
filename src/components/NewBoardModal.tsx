import React, { useState, useEffect, useRef } from 'react';
import { X, FolderOpen, Plus, ArrowLeft } from 'lucide-react';
import { Project } from '../types';

const PROJECT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1'
];

interface NewBoardModalProps {
  projects: Project[];
  defaultProjectId?: string | null;
  onSubmit: (boardName: string, projectGroupId: string | null) => void;
  onCreateProject: (title: string, color: string) => Promise<Project | void>;
  onClose: () => void;
  defaultBoardName?: string;
}

export default function NewBoardModal({
  projects,
  defaultProjectId,
  onSubmit,
  onCreateProject,
  onClose,
  defaultBoardName = ''
}: NewBoardModalProps) {
  const [boardName, setBoardName] = useState(defaultBoardName);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [view, setView] = useState<'main' | 'new-project'>('main');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const boardInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => boardInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (view === 'new-project') setTimeout(() => projectInputRef.current?.focus(), 50);
  }, [view]);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    const created = await onCreateProject(newProjectTitle.trim(), newProjectColor);
    if (created && 'id' in created) {
      setSelectedProjectId(created.id);
    }
    setView('main');
    setNewProjectTitle('');
    setNewProjectColor(PROJECT_COLORS[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    setSaving(true);
    await onSubmit(boardName.trim(), selectedProjectId);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-96 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {view === 'new-project' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setView('main')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <ArrowLeft size={18} className="text-gray-500" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Project</h3>
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Board</h3>
          )}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* New Project view */}
        {view === 'new-project' ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Project Name</label>
              <input
                ref={projectInputRef}
                type="text"
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateProject(); }
                  if (e.key === 'Escape') setView('main');
                }}
                placeholder="e.g. Website Relaunch, Mobile App..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewProjectColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${newProjectColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setView('main')}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleCreateProject} disabled={!newProjectTitle.trim()}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                Create Project
              </button>
            </div>
          </div>
        ) : (
          /* Main view */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Board Name</label>
              <input
                ref={boardInputRef}
                type="text"
                value={boardName}
                onChange={e => setBoardName(e.target.value)}
                placeholder="e.g. Development, Design, Sprint 1..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Project <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                <button type="button" onClick={() => setSelectedProjectId(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedProjectId === null
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                  <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-500 flex-shrink-0" />
                  No Project
                </button>
                {projects.map(p => (
                  <button key={p.id} type="button" onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedProjectId === p.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <FolderOpen size={13} className="flex-shrink-0" style={{ color: p.color }} />
                    {p.title}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setView('new-project')}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                <Plus size={13} />
                New Project
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={!boardName.trim() || saving}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                {saving ? 'Creating...' : 'Create Board'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
