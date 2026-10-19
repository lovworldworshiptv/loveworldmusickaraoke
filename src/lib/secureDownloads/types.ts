export interface DownloadedTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  lyricsLrc?: string;
  durationSeconds: number;
  album?: string;
  isFreeDownload?: boolean;
  downloadedAt: number;
  hasInstrumental?: boolean;
  video?: { id: string; video_type: string; language_code: string; offset_ms: number; thumbnail_url: string | null };
}

export type SecureKind = "audio" | "instrumental" | "video";

export interface WrappedLicence {
  licenceId: string;
  /** "A256KW" for AES key wrap; absent on licences issued before the switch (AES-GCM wrap). */
  alg?: string;
  ephemeralPublicKey: JsonWebKey;
  iv: string;
  wrappedKey: string;
  expiresAt: string;
}

/** Where a package's encrypted chunks live. Absent on packages saved before OPFS support = "idb". */
export type ChunkBackend = "opfs" | "idb";

export interface SecurePackage {
  packageId: string;
  kind: SecureKind;
  mimeType: string;
  chunkSize: number;
  chunkCount: number;
  byteLength: number;
  storage?: ChunkBackend;
  licence?: WrappedLicence;
}

export type ChunkRef = Pick<SecurePackage, "packageId" | "storage">;

export type SecureStatus = "queued" | "preparing" | "downloading" | "ready" | "paused" | "failed" | "locked";
export type SecureSource = "user" | "restore" | "legacy";

export interface SecureItem {
  songId: string;
  userId: string;
  meta: DownloadedTrack;
  language?: string;
  status: SecureStatus;
  /** 0 = asked for right now, 1 = account restore, 2 = background migration. */
  priority: number;
  source: SecureSource;
  packages: SecurePackage[];
  error?: string;
  addedAt: number;
  updatedAt: number;
}

export interface DeviceRecord {
  deviceId: string;
  userId: string;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
  createdAt: number;
}

export interface DeviceInfo {
  id: string;
  label: string;
  user_agent?: string | null;
  created_at: string;
  last_active_at: string;
}
