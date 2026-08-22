"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DOC_CATEGORIES } from "@/lib/crm-constants";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  BtnSecondary,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Document = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedAt: string;
  uploadedBy: { name: string } | null;
};

export default function DocumentsPage() {
  const auth = useAuth();
  const canAdd = auth.hasPermission("add");
  const canDelete = auth.hasPermission("delete");
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const url = category ? `/api/documents?category=${category}` : "/api/documents";
      setDocs(await apiFetch<Document[]>(url));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [category]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category || "general");
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading && docs.length === 0) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Files"
        title="Document Library"
        description="Upload, organize, and manage workspace documents"
        action={
          canAdd ? (
            <>
              <BtnSecondary onClick={() => fileRef.current?.click()} className="!inline-flex">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
              </BtnSecondary>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            </>
          ) : undefined
        }
      />

      <Panel
        title={`${docs.length} documents`}
        action={
          <select className="pro-input text-sm py-1.5 px-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {DOC_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        }
        noPadding
      >
        {docs.length === 0 ? (
          <EmptyState title="No documents" description="Upload a file to get started" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>File Name</Th>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th className="text-right">Size</Th>
                <Th>Uploaded By</Th>
                <Th>Date</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{d.fileName}</Td>
                  <Td className="capitalize">{d.category}</Td>
                  <Td className="text-xs text-slate-500">{d.mimeType}</Td>
                  <Td className="text-right tabular-nums">{(d.fileSize / 1024).toFixed(1)} KB</Td>
                  <Td>{d.uploadedBy?.name || "—"}</Td>
                  <Td className="tabular-nums">{formatDate(d.uploadedAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/api/documents/${d.id}/download`} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {canDelete && (
                        <button type="button" onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-700" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
