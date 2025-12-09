import { Document } from '../types';
import { supabase } from './supabaseClient';

// Helper to convert Base64 to Blob for uploading
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

// Helper to convert Blob to Base64 for app usage
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const saveDocument = async (doc: Document): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // 1. Check if document exists to determine if we update or insert
  const { data: existing } = await supabase
    .from('documents')
    .select('id, file_path')
    .eq('id', doc.id)
    .single();

  let filePath = existing?.file_path;

  // 2. Upload PDF to Storage ONLY if it's a new upload (has base64Data) and path isn't set
  // Or if we decide to support file replacement later.
  if (doc.base64Data && (!existing || !filePath)) {
    const fileName = `${user.id}/${doc.id}.pdf`;
    const blob = base64ToBlob(doc.base64Data, doc.type);
    
    const { error: uploadError } = await supabase.storage
      .from('document-files')
      .upload(fileName, blob, { upsert: true });

    if (uploadError) throw uploadError;
    filePath = fileName;
  }

  // 3. Prepare metadata (excluding base64Data to save DB space)
  // We store the "app state" (chat, summary, etc) in a JSONB column
  const { base64Data, ...metaData } = doc;
  
  const payload = {
    id: doc.id,
    user_id: user.id,
    name: doc.name,
    size: doc.size,
    type: doc.type,
    upload_date: doc.uploadDate,
    file_path: filePath,
    app_data: metaData // Stores summary, chatHistory, mindMap, etc.
  };

  const { error: dbError } = await supabase
    .from('documents')
    .upsert(payload);

  if (dbError) throw dbError;
};

/**
 * Loads ONLY metadata for the list view. 
 * Does NOT download the PDF file to save bandwidth.
 */
export const getAllDocuments = async (): Promise<Document[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch metadata
  const { data: rows, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rows) return [];

  // Reconstruct Document objects (Metadata only)
  return rows.map((row) => ({
      ...row.app_data,
      id: row.id, 
      file_path: row.file_path,
      // NOTE: base64Data is intentionally undefined here
    } as Document));
};

/**
 * Downloads the actual PDF file from Supabase Storage for a specific document.
 */
export const loadDocumentFile = async (path: string): Promise<string> => {
    const { data: fileData, error: fileError } = await supabase.storage
      .from('document-files')
      .download(path);

    if (fileError) throw fileError;
    if (!fileData) throw new Error("File not found");

    return await blobToBase64(fileData);
};

export const deleteDocument = async (id: string): Promise<void> => {
  const { data: row } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', id)
    .single();

  if (row?.file_path) {
    await supabase.storage.from('document-files').remove([row.file_path]);
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
};

export const clearAllData = async (): Promise<void> => {
  // This clears ONLY the current user's data due to RLS policies
  // Note: Deleting files in bulk from storage requires knowing the paths, 
  // simplified here to just cleaning DB.
  
  const { error } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  if (error) throw error;
};