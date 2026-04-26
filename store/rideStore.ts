import { create } from "zustand";
import type { RideRequest } from "@/lib/types";

interface RideStore {
  currentRide: RideRequest | null;
  setCurrentRide: (ride: RideRequest | null) => void;
}

export const useRideStore = create<RideStore>((set) => ({
  currentRide: null,
  setCurrentRide: (ride) => set({ currentRide: ride }),
}));
