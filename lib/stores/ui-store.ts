import { create } from "zustand";

type UiState = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

/** Lightweight client UI chrome only — server state belongs in TanStack Query later. */
export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
