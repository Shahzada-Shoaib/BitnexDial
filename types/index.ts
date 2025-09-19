// types/index.ts
export interface Contact {
  id: string;
  phone: string;
  name: string;
  type: 'personal';
  profileColor?: string;
}

export interface CallRecord {
  id: string;
  number: string;
  name: string;
  type: 'missed' | 'incoming' | 'outgoing';
  time: string;
  date: string;
  duration?: string;
}

export interface Voicemail {
  id?: string;
  callerid?: string;
  caller?: string;
  origtime?: number;
  duration?: number;
  read?: string;
  recording_url?: string;
  audio_url?: string;
}

export interface BlockedContact {
  contact: string;
  blocked_at: string;
}

// Add to types/index.ts

export interface CallRecording {
    id: string;
    filename: string;
    caller: string;
    callee: string;
    other_party: string;
    direction: 'inbound' | 'outbound';
    created_time: number;
    file_size: number;
    audio_url: string;
    date_iso?: string;
    date_local?: string;
    extension?: string;
}