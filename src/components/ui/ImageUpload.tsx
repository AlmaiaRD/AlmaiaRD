"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, X, Loader2 } from "lucide-react";

interface ImageUploadProps {
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
}

export function ImageUpload({ currentUrl, onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen no puede superar 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      setPreview(publicUrl);
      onUploaded(publicUrl);
    } catch (err: any) {
      alert(err?.message || "Error al subir imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    setPreview(null);
    onUploaded(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Imagen del producto</label>
      <div className="flex items-start gap-4">
        {preview ? (
          <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[#E8E0D8] bg-[#FAF6F0] flex-shrink-0">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-[#E8E0D8] bg-[#FAF6F0] flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-[#9C8A82]" />
          </div>
        )}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            id="product-image-input"
          />
          <label
            htmlFor="product-image-input"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] font-medium hover:bg-[#FAF6F0] transition-all cursor-pointer"
          >
            {uploading ? (
              <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
            ) : (
              <><Upload size={16} /> {preview ? "Cambiar imagen" : "Seleccionar imagen"}</>
            )}
          </label>
          <p className="text-xs text-[#9C8A82] mt-2">PNG, JPG o WEBP. Máximo 2MB.</p>
        </div>
      </div>
    </div>
  );
}
