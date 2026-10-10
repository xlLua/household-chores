import { createContext, useContext, type ReactNode } from 'react'
import { useBoard, type Board } from './useBoard'

const BoardContext = createContext<Board | null>(null)

/** Mounted once inside the auth gate so every tab shares one dataset and one
 *  realtime subscription. */
export function BoardProvider({ children }: { children: ReactNode }) {
  const board = useBoard()
  return <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
}

export function useBoardContext(): Board {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoardContext must be used inside <BoardProvider>')
  return ctx
}
