import { createContext, useContext } from 'react';

// Ações de interface compartilhadas: abrir a aba lateral, abrir a edição de
// um item, mostrar um aviso rápido na parte de baixo da tela.
export const UIContext = createContext({
  openDrawer: () => {},
  openEditor: () => {},
  openBatch: () => {},
  showToast: () => {},
  removeWithUndo: () => {},
  openMonth: () => {},
});

export const useUI = () => useContext(UIContext);
