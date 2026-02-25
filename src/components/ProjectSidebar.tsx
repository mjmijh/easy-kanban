import React, { useState, useRef, useEffect } from 'react';
import { Project, Board } from '../types';
import { 
  FolderOpen, ChevronRight, ChevronDown, Plus, 
  MoreHorizontal, Pencil, Trash2, X, Check,
  Layers, Menu
} from 'lucide-react';

const PROJECT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1'
];

interface ProjectSidebarProps {
  projects: Project[];
  boards: Board[];
  selectedBoard: string | null;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelectBoard: (boardId: string) => void;
  onCreateProject: (title: string, color: string) => Promise<void>;
  onUpdateProject: (id: string, title: string, color: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onAssignBoardToProject: (boardId: string, projectId: string | null) => Promise<void>;
  selectedProjectId: string | null; // null = "All"
  onSelectProject: (projectId: string | null) => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  boards,
  selectedBoard,
  isAdmin,
  isOpen,
  onToggle,
  onSelectBoard,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onAssignBoardToProject,
  selectedProjectId,
  onSelectProject,
}) => {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [boardMenuOpenId, setBoardMenuOpenId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpenId && !(e.target as Element).closest('.project-menu-container')) {
        setMenuOpenId(null);
        setDeleteConfirmId(null);
      }
      if (boardMenuOpenId && !(e.target as Element).closest('.board-menu-container')) {
        setBoardMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId, boardMenuOpenId]);

  // Auto-expand project containing selected board
  useEffect(() => {
    if (selectedBoard) {
      const board = boards.find(b => b.id === selectedBoard);
      if (board?.project_group_id) {
        setExpandedProjects(prev => new Set([...prev, board.project_group_id!]));
      }
    }
  }, [selectedBoard, boards]);

  useEffect(() => {
    if (editingProjectId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProjectId]);

  useEffect(() => {
    if (creatingProject && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [creatingProject]);

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const startEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
    setEditingColor(project.color);
    setMenuOpenId(null);
  };

  const saveEdit = async () => {
    if (!editingProjectId || !editingTitle.trim()) return;
    await onUpdateProject(editingProjectId, editingTitle.trim(), editingColor);
    setEditingProjectId(null);
  };

  const cancelEdit = () => setEditingProjectId(null);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    await onCreateProject(newProjectTitle.trim(), newProjectColor);
    setNewProjectTitle('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setCreatingProject(false);
  };

  const getBoardsForProject = (projectId: string) =>
    boards.filter(b => b.project_group_id === projectId);

  const ungroupedBoards = boards.filter(b => !b.project_group_id);

  if (!isOpen) {
    // Collapsed — show only toggle button + icon indicators
    return (
      <div className="flex flex-col items-center w-12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 py-3 gap-2">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          title="Open project sidebar"
        >
          <Menu size={18} />
        </button>
        <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-1" />
        {/* All indicator */}
        <button
          onClick={() => { onSelectProject(null); onToggle(); }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            selectedProjectId === null
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
              : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="All projects"
        >
          <Layers size={15} />
        </button>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => { onSelectProject(p.id); onToggle(); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              selectedProjectId === p.id
                ? 'ring-2 ring-offset-1 ring-blue-400'
                : 'hover:opacity-80'
            }`}
            style={{ backgroundColor: p.color + '33' }}
            title={p.title}
          >
            <FolderOpen size={14} style={{ color: p.color }} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-52 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400"
          title="Collapse sidebar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2">

        {/* Create project (admin only) - top of list */}
        {isAdmin && (
          <div className="px-2 pb-1">
            {creatingProject ? (
              <div className="space-y-1.5 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <input
                  ref={newInputRef}
                  value={newProjectTitle}
                  onChange={e => setNewProjectTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setCreatingProject(false);
                  }}
                  placeholder="Project name..."
                  className="w-full text-sm px-2 py-1 border border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <div className="flex flex-wrap gap-1 px-1">
                  {PROJECT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewProjectColor(c)}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        newProjectColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={handleCreateProject} disabled={!newProjectTitle.trim()}
                    className="flex-1 text-xs bg-blue-500 disabled:opacity-50 text-white rounded px-2 py-1 hover:bg-blue-600">
                    Create
                  </button>
                  <button onClick={() => setCreatingProject(false)}
                    className="flex-1 text-xs bg-gray-200 dark:bg-gray-700 rounded px-2 py-1">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreatingProject(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-blue-300 dark:border-blue-700">
                <Plus size={13} />
                New Project
              </button>
            )}
          </div>
        )}

        {/* All Projects */}
        <button
          onClick={() => {
            onSelectProject(null);
            const firstBoard = boards[0];
            if (firstBoard) onSelectBoard(firstBoard.id);
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
            selectedProjectId === null
              ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Layers size={14} className="flex-shrink-0" />
          <span className="truncate">All Boards</span>
          <span className="ml-auto text-xs text-gray-400">{boards.length}</span>
        </button>

        <div className="my-1 mx-3 h-px bg-gray-200 dark:bg-gray-700" />

        {/* Project list */}
        {projects.map(project => {
          const projectBoards = getBoardsForProject(project.id);
          const isExpanded = expandedProjects.has(project.id);
          const isSelected = selectedProjectId === project.id;
          const isEditing = editingProjectId === project.id;

          return (
            <div key={project.id}>
              {/* Project row */}
              <div
                className={`group flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/40'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(project.id)}
                  className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                >
                  {isExpanded
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />
                  }
                </button>

                {/* Color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />

                {isEditing ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="flex-1 text-sm px-1 py-0 border border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-0"
                    />
                    {/* Color picker inline */}
                    <div className="flex gap-0.5 flex-wrap w-20">
                      {PROJECT_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditingColor(c)}
                          className={`w-3 h-3 rounded-full border-2 transition-all ${
                            editingColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button onClick={saveEdit} className="text-green-500 hover:text-green-700">
                      <Check size={13} />
                    </button>
                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onSelectProject(project.id);
                        const firstBoard = getBoardsForProject(project.id)[0];
                        if (firstBoard) onSelectBoard(firstBoard.id);
                      }}
                      className={`flex-1 text-left text-sm truncate ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {project.title}
                    </button>
                    <span className="text-xs text-gray-400 mr-1">{projectBoards.length}</span>

                    {/* Admin menu */}
                    {isAdmin && (
                      <div className="relative project-menu-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === project.id ? null : project.id);
                            setDeleteConfirmId(null);
                          }}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-400"
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {menuOpenId === project.id && (
                          <div className="absolute right-0 top-6 z-50 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                            <button
                              onClick={() => startEdit(project)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Pencil size={13} /> Rename
                            </button>
                            {deleteConfirmId === project.id ? (
                              <div className="px-3 py-2">
                                <p className="text-xs text-red-600 dark:text-red-400 mb-1">Delete project?</p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      await onDeleteProject(project.id);
                                      setMenuOpenId(null);
                                      setDeleteConfirmId(null);
                                    }}
                                    className="flex-1 text-xs bg-red-500 text-white rounded px-2 py-0.5 hover:bg-red-600"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 text-xs bg-gray-200 dark:bg-gray-700 rounded px-2 py-0.5"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(project.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Board list under project */}
              {isExpanded && (
                <div className="ml-5 border-l border-gray-200 dark:border-gray-700 pl-2 py-0.5">
                  {projectBoards.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-1 italic">No boards</p>
                  ) : (
                    projectBoards.map(board => (
                      <div key={board.id} className="group flex items-center">
                        <button
                          onClick={() => { onSelectProject(project.id); onSelectBoard(board.id); }}
                          className={`flex-1 text-left px-2 py-1 text-xs rounded transition-colors truncate ${
                            selectedBoard === board.id
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {board.title}
                        </button>
                        {isAdmin && (
                          <div className="relative board-menu-container flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); setBoardMenuOpenId(boardMenuOpenId === board.id ? null : board.id); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                              <MoreHorizontal size={12} />
                            </button>
                            {boardMenuOpenId === board.id && (
                              <div className="absolute right-0 top-5 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                                <p className="px-3 py-1 text-xs text-gray-400 font-medium">Move to project</p>
                                <button onClick={() => { onAssignBoardToProject(board.id, null); setBoardMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                  <span className="w-2 h-2 rounded-full bg-gray-300" /> Ungrouped
                                </button>
                                {projects.filter(p => p.id !== project.id).map(p => (
                                  <button key={p.id} onClick={() => { onAssignBoardToProject(board.id, p.id); setBoardMenuOpenId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} /> {p.title}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped boards */}
        {ungroupedBoards.length > 0 && (
          <div className="mt-1">
            <div className="my-1 mx-3 h-px bg-gray-200 dark:bg-gray-700" />
            <p className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wider font-medium">
              Ungrouped
            </p>
            {ungroupedBoards.map(board => (
              <div key={board.id} className="group flex items-center">
                <button
                  onClick={() => onSelectBoard(board.id)}
                  className={`flex-1 text-left px-3 py-1.5 text-sm rounded transition-colors truncate ${
                    selectedBoard === board.id
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {board.title}
                </button>
                {isAdmin && (
                  <div className="relative board-menu-container flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setBoardMenuOpenId(boardMenuOpenId === board.id ? null : board.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                      <MoreHorizontal size={13} />
                    </button>
                    {boardMenuOpenId === board.id && (
                      <div className="absolute right-0 top-6 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                        <p className="px-3 py-1 text-xs text-gray-400 font-medium">Move to project</p>
                        {projects.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400 italic">No projects yet</p>
                        ) : projects.map(p => (
                          <button key={p.id} onClick={() => { onAssignBoardToProject(board.id, p.id); setBoardMenuOpenId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            {p.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default ProjectSidebar;
