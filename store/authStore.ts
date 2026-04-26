import { create } from "zustand";
import type { UserRole } from "@/lib/types";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthStore {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
