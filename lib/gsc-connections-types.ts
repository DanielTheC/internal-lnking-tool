export type GscConnectionStored = {
  id: string;
  email: string;
  /** Optional display name (e.g. "Agency account A"). */
  label?: string;
  createdAt: number;
  refreshToken: string;
};

export type GscConnectionPublic = Omit<GscConnectionStored, "refreshToken">;
