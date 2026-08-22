import fs from "fs";
import path from "path";

export const brandingDir = path.join(process.cwd(), "uploads", "branding");
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

export type BrandType = "logo" | "signature" | "stamp";

export function brandField(type: BrandType): "logoPath" | "signaturePath" | "stampPath" {
  if (type === "logo") return "logoPath";
  if (type === "signature") return "signaturePath";
  return "stampPath";
}

/** Persist uploaded brand file under uploads/branding/{workspaceId}/ */
export function saveWorkspaceBrandFile(
  workspaceId: string,
  type: BrandType,
  file: { path: string; originalname: string }
): string {
  if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
  const ext = path.extname(file.originalname) || ".png";
  const destDir = path.join(brandingDir, workspaceId);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, `${type}${ext}`);
  fs.renameSync(file.path, destPath);
  return destPath;
}

export function removeBrandFile(filePath: string | null | undefined) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
