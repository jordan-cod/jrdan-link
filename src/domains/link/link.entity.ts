export interface Link {
  id: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

export interface NewLink {
  id: string;
  url: string;
  expiresAt?: Date;
}

export interface LinkPatch {
  url?: string;
  expiresAt?: Date;
  active?: boolean;
}
