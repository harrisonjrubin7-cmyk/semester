import {createContext, useContext} from 'react';

/** The modern shell owns search and tabs; original layout keeps its controls. */
export const ModernShellContext = createContext(false);
export const useModernShell = () => useContext(ModernShellContext);
