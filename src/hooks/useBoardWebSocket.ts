import { useCallback, RefObject } from 'react';
import { Columns, Board } from '../types';

interface UseBoardWebSocketProps {
  // State setters
  setSelectedBoard: React.Dispatch<React.SetStateAction<string | null>>;
  setColumns: React.Dispatch<React.SetStateAction<Columns>>;
  setBoards: React.Dispatch<React.SetStateAction<Board[]>>;
  
  // Refs
  selectedBoardRef: RefObject<string | null>;
  refreshBoardDataRef: RefObject<(() => Promise<void>) | null>;
}

export const useBoardWebSocket = ({
  setSelectedBoard,
  setColumns,
  setBoards,
  selectedBoardRef,
  refreshBoardDataRef,
}: UseBoardWebSocketProps) => {
  
  const handleBoardCreated = useCallback((data: any) => {
    if (!data.board || !data.boardId) return;
    
    // Refresh board data to get the complete structure including columns
    // Don't add the board with empty columns to avoid race conditions
    if (refreshBoardDataRef.current) {
      refreshBoardDataRef.current();
    }
  }, [refreshBoardDataRef]);

  const handleBoardUpdated = useCallback((data: any) => {
    console.log('🔄 Refreshing board data due to board update...');
    // Refresh boards list
    if (refreshBoardDataRef.current) {
      refreshBoardDataRef.current();
    }
  }, [refreshBoardDataRef]);

  const handleBoardDeleted = useCallback((data: any) => {
    // If the deleted board was selected, clear selection
    if (data.boardId === selectedBoardRef.current) {
      setSelectedBoard(null);
      setColumns({});
    }
    // Refresh boards list
    if (refreshBoardDataRef.current) {
      refreshBoardDataRef.current();
    }
  }, [setSelectedBoard, setColumns, selectedBoardRef, refreshBoardDataRef]);

  const handleBoardReordered = useCallback((data: any) => {
    // Refresh boards list to show new order
    if (refreshBoardDataRef.current) {
      refreshBoardDataRef.current();
    }
  }, [refreshBoardDataRef]);

  return {
    handleBoardCreated,
    handleBoardUpdated,
    handleBoardDeleted,
    handleBoardReordered,
  };
};

