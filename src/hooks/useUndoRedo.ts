import { useState, useCallback } from 'react';

export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initialState: T, maxHistory = 20) {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback((newPresent: T) => {
    setState((currentState) => {
      const newPast = [...currentState.past, currentState.present];
      
      // Limit history size
      if (newPast.length > maxHistory) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newPresent,
        future: [],
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState;

      const newPast = [...currentState.past];
      const newPresent = newPast.pop()!;

      return {
        past: newPast,
        present: newPresent,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState;

      const newFuture = [...currentState.future];
      const newPresent = newFuture.shift()!;

      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}