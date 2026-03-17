import { Router } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const router = Router();

// File upload configuration
// In production, replace with S3/R2 upload using @aws-sdk/client-s3
// For now, stores files locally in /uploads directory

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

router.post("/api/upload", async (req, res) => {
  try {
    // Express doesn't handle multipart by default
    // In production, use multer + S3:
    //   import multer from "multer";
    //   import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
    //   const upload = multer({ storage: multerS3({ s3, bucket: process.env.S3_BUCKET }) });

    // For now, accept base64-encoded file in JSON body
    const { fileName, fileData, bureau, userId } = req.body;

    if (!fileName || !fileData || !bureau || !userId) {
      return res.status(400).json({ error: "Missing required fields: fileName, fileData, bureau, userId" });
    }

    const fileId = randomUUID();
    const ext = path.extname(fileName) || ".pdf";
    const storedName = `${fileId}${ext}`;

    // Decode base64 and save
    const buffer = Buffer.from(fileData, "base64");
    const filePath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(filePath, buffer);

    res.json({
      id: fileId,
      fileName,
      storedName,
      fileSize: buffer.length,
      bureau,
      userId,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
