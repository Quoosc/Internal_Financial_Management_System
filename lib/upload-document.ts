import { api } from "@/lib/api-client";

type Signature = { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string };
type Uploaded = { public_id: string; secure_url: string; bytes: number; version: number; signature: string };

/** Register actual signed uploads so Excel can reference evidence by server ID. */
export async function uploadRegisteredDocument(file: File) {
  const { data: signature } = await api.get<Signature>("/api/v1/uploads/signature?folder=REQUEST");
  const body = new FormData();
  body.append("file", file); body.append("api_key", signature.apiKey);
  body.append("timestamp", String(signature.timestamp)); body.append("signature", signature.signature);
  body.append("folder", signature.folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`, { method: "POST", body });
  if (!response.ok) throw new Error("Không upload được chứng từ vào kho lưu trữ.");
  const uploaded: Uploaded = await response.json();
  return (await api.post<{ id: number; fileName: string; url: string }>("/api/v1/uploads/documents", {
    fileName: file.name, cloudinaryPublicId: uploaded.public_id, url: uploaded.secure_url,
    fileType: file.type, size: uploaded.bytes, uploadVersion: uploaded.version, uploadSignature: uploaded.signature,
  })).data;
}
