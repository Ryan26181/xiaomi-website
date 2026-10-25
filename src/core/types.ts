// What Rust sends the page (camelCase, see src-tauri/src/*.rs).

export interface MediaState {
  active: boolean;
  source: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  position: number;
  positionAt: number;
  playing: boolean;
  canPrevious: boolean;
  canNext: boolean;
  canSeek: boolean;
  artKey: string;
}

export interface Artwork {
  artKey: string;
  dataUrl: string;
}

export type DeviceKind = "headphones" | "speaker" | "keyboard" | "mouse" | "phone" | "controller" | "other";

export interface BtDevice {
  id: string;
  name: string;
  connected: boolean;
  kind: DeviceKind;
  battery: number | null;
  initial: boolean;
}

export interface PowerState {
  hasBattery: boolean;
  plugged: boolean;
  charging: boolean;
  percent: number;
}

export interface ShelfFile {
  path: string;
  name: string;
  ext: string;
  isDir: boolean;
  size: number;
  exists: boolean;
  thumbnail: string | null;
}

export interface PlatformInfo {
  os: string;
  cursorPoll: boolean;
  version: string;
}

export const EMPTY_MEDIA: MediaState = {
  active: false,
  source: "",
  title: "",
  artist: "",
  album: "",
  duration: 0,
  position: 0,
  positionAt: 0,
  playing: false,
  canPrevious: false,
  canNext: false,
  canSeek: false,
  artKey: "",
};
