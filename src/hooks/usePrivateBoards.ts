import { useCallback, useMemo } from 'react';
import { useStorageAdapter } from './useLocalStorage';
import { privateBoardStore, privateCardStore, privateListStore } from '../lib/storage';
import type { PrivateBoard, PrivateCard, PrivateList } from '../types';

/**
 * Generates a UUID-ish ID without crypto.randomUUID dependency,
 * matching the convention of the rest of the codebase.
 */
function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Hook for the private todo-board feature (Trello-style).
 * Wraps three separate stores (boards, lists, cards) and exposes a
 * cohesive API including cascade-delete + drag-and-drop reordering.
 */
export function usePrivateBoards() {
  const boards = useStorageAdapter<PrivateBoard>(privateBoardStore);
  const lists = useStorageAdapter<PrivateList>(privateListStore);
  const cards = useStorageAdapter<PrivateCard>(privateCardStore);

  // ============= Boards =============
  const sortedBoards = useMemo(
    () => [...boards.items].sort((a, b) => a.order - b.order),
    [boards.items],
  );

  /**
   * Boards die der User in die Sidebar gepinnt hat.
   * Sortiert nach `pinOrder` (falls gesetzt), sonst nach `createdAt` als Fallback.
   */
  const pinnedBoards = useMemo(
    () => sortedBoards
      .filter((b) => b.pinned)
      .sort((a, b) => {
        const ao = a.pinOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.pinOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [sortedBoards],
  );

  const createBoard = useCallback(
    (data: { name: string; icon?: string; accent?: string }) => {
      const order = sortedBoards.length;
      const board: PrivateBoard = {
        id: makeId(),
        name: data.name,
        icon: data.icon,
        accent: data.accent,
        order,
        createdAt: new Date().toISOString(),
      };
      boards.create(board);

      // Seed default lists so the new board is immediately useful
      const defaults: Array<{ name: string }> = [
        { name: 'To do' },
        { name: 'In Arbeit' },
        { name: 'Erledigt' },
      ];
      defaults.forEach((d, i) => {
        privateListStore.create({
          id: makeId(),
          boardId: board.id,
          name: d.name,
          order: i,
          createdAt: new Date().toISOString(),
        });
      });

      return board;
    },
    [boards, sortedBoards.length],
  );

  const updateBoard = useCallback(
    (id: string, updates: Partial<PrivateBoard>) => boards.update(id, updates),
    [boards],
  );

  /**
   * Pin/Unpin ein Board für die Sidebar.
   * Beim Pinnen bekommt das Board automatisch die nächste freie pinOrder, damit
   * neue Pins ans Ende der Sidebar-Liste rutschen.
   */
  const togglePinBoard = useCallback(
    (id: string) => {
      const board = boards.items.find((b) => b.id === id);
      if (!board) return;
      if (board.pinned) {
        boards.update(id, { pinned: false, pinOrder: undefined });
      } else {
        const maxOrder = boards.items
          .filter((b) => b.pinned)
          .reduce((acc, b) => Math.max(acc, b.pinOrder ?? -1), -1);
        boards.update(id, { pinned: true, pinOrder: maxOrder + 1 });
      }
    },
    [boards],
  );

  const deleteBoard = useCallback(
    (id: string) => {
      // Cascade: remove lists + cards belonging to this board
      privateListStore.getByField('boardId', id).forEach((l) => privateListStore.delete(l.id));
      privateCardStore.getByField('boardId', id).forEach((c) => privateCardStore.delete(c.id));
      boards.remove(id);
    },
    [boards],
  );

  // ============= Lists =============
  const listsForBoard = useCallback(
    (boardId: string) =>
      lists.items.filter((l) => l.boardId === boardId).sort((a, b) => a.order - b.order),
    [lists.items],
  );

  const createList = useCallback(
    (boardId: string, name: string) => {
      const order = lists.items.filter((l) => l.boardId === boardId).length;
      const list: PrivateList = {
        id: makeId(),
        boardId,
        name,
        order,
        createdAt: new Date().toISOString(),
      };
      lists.create(list);
      return list;
    },
    [lists],
  );

  const renameList = useCallback(
    (id: string, name: string) => lists.update(id, { name }),
    [lists],
  );

  const deleteList = useCallback(
    (id: string) => {
      privateCardStore.getByField('listId', id).forEach((c) => privateCardStore.delete(c.id));
      lists.remove(id);
    },
    [lists],
  );

  const reorderLists = useCallback(
    (boardId: string, orderedIds: string[]) => {
      orderedIds.forEach((id, index) => {
        const existing = lists.items.find((l) => l.id === id);
        if (existing && existing.order !== index) lists.update(id, { order: index });
      });
      // Sicherheitshalber boardId-Argument referenzieren, damit ESLint nicht meckert
      void boardId;
    },
    [lists],
  );

  // ============= Cards =============
  const cardsForList = useCallback(
    (listId: string) =>
      cards.items.filter((c) => c.listId === listId).sort((a, b) => a.order - b.order),
    [cards.items],
  );

  const createCard = useCallback(
    (input: { listId: string; boardId: string; title: string }) => {
      const order = cards.items.filter((c) => c.listId === input.listId).length;
      const card: PrivateCard = {
        id: makeId(),
        listId: input.listId,
        boardId: input.boardId,
        title: input.title,
        order,
        createdAt: new Date().toISOString(),
      };
      cards.create(card);
      return card;
    },
    [cards],
  );

  const updateCard = useCallback(
    (id: string, updates: Partial<PrivateCard>) => cards.update(id, updates),
    [cards],
  );

  const deleteCard = useCallback((id: string) => cards.remove(id), [cards]);

  const moveCard = useCallback(
    (cardId: string, targetListId: string, newOrder: number) => {
      const card = cards.items.find((c) => c.id === cardId);
      if (!card) return;
      cards.update(cardId, { listId: targetListId, order: newOrder });
    },
    [cards],
  );

  return {
    // boards
    boards: sortedBoards,
    pinnedBoards,
    createBoard,
    updateBoard,
    togglePinBoard,
    deleteBoard,
    getBoardById: (id: string) => sortedBoards.find((b) => b.id === id),
    // lists
    listsForBoard,
    createList,
    renameList,
    deleteList,
    reorderLists,
    // cards
    cardsForList,
    allCards: cards.items,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  };
}
