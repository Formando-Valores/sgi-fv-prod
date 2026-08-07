import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface PaymentProofUploadButtonProps {
  processRow: { processRecordId?: string | null };
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  uploadingForProcess: string | null;
  setUploadingForProcess: (pid: string | null) => void;
}

const PaymentProofUploadButton: React.FC<PaymentProofUploadButtonProps> = ({
  processRow,
  isUploading,
  onUpload,
  uploadingForProcess,
  setUploadingForProcess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pid = processRow.processRecordId;
  const loading = isUploading && !!pid && uploadingForProcess === pid;

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploadingForProcess(pid);
          await onUpload(file);
          setUploadingForProcess(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
        ) : (
          <><Upload className="h-4 w-4" /> Enviar Comprovante de Pagamento</>
        )}
      </button>
      <p className="text-xs text-surface-500 text-center mt-1">Aceito: imagem ou PDF</p>
    </div>
  );
};

export default PaymentProofUploadButton;
