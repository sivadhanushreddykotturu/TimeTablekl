import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const SyncContext = createContext({
  isSyncing: false,
  triggerSync: async () => {},
  registerSyncHandler: () => () => {},
  setIsSyncing: () => {}
});

export function SyncProvider({ children }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncHandlerRef = useRef(null);

  const registerSyncHandler = useCallback((handler) => {
    syncHandlerRef.current = handler;
    return () => {
      if (syncHandlerRef.current === handler) {
        syncHandlerRef.current = null;
      }
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncHandlerRef.current) {
      setIsSyncing(true);
      try {
        await syncHandlerRef.current();
      } catch (err) {
        console.error("Sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, []);

  return (
    <SyncContext.Provider value={{ isSyncing, triggerSync, registerSyncHandler, setIsSyncing }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
