export interface UploadedImage {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: 'pending' | 'processing' | 'processed' | 'error';
  error_message?: string;
  processed_at?: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  user_id: string;
  image_id: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ExtractedReadings;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ExtractedReadings {
  readings: ExtractedReading[];
}

export interface ExtractedReading {
  date: string;
  value: number;
  unit: string;
  notes?: string;
}

export interface UploadResponse {
  data: UploadedImage[];
  message: string;
}

export interface ProcessStartResponse {
  job_ids: string[];
  message: string;
}

export interface ProcessStatusResponse {
  id: string;
  status: string;
  result?: ExtractedReadings;
  error?: string;
}
