'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { storageApi } from '@/lib/api/storage';
import type { Document, DocumentType } from '@/components/documents';

function mapFileType(mime: string): DocumentType {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('word') || mime.includes('docx')) return 'docx';
  if (mime.includes('sheet') || mime.includes('xlsx')) return 'xlsx';
  return 'txt';
}

const DocumentViewerModal = dynamic(
  () =>
    import('@/components/documents').then((mod) => ({
      default: mod.DocumentViewerModal,
    })),
  { ssr: false },
);

export default function UserDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const files = await storageApi.listFiles();
        const match = files.find((file) => file.id === documentId);
        if (!match) {
          if (active) setError('Document not found');
          return;
        }
        const url = await storageApi.getDownloadUrl(match.s3Key);
        if (active) {
          setDocument({
            id: match.id,
            name: match.fileName,
            type: mapFileType(match.fileType),
            url,
            size: match.fileSize,
            uploadedBy: '',
            uploadedByName: 'You',
            uploadedAt: match.createdAt,
            category: 'other',
          });
        }
      } catch {
        if (active) setError('Failed to load document');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-blue-200/60">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading document...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-white font-semibold mb-2">{error ?? 'Not found'}</p>
        <Link
          href="/user/documents"
          className="text-blue-400 hover:text-blue-300"
        >
          ← Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button
        type="button"
        onClick={() => router.push('/user/documents')}
        className="inline-flex items-center gap-2 text-sm text-blue-200/60 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        All documents
      </button>

      <DocumentViewerModal
        onClose={() => router.push('/user/documents')}
        document={document}
      />
    </div>
  );
}
