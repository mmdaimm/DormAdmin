import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as Blob | null;
    const roomNumber = formData.get('roomNumber') as string | null;

    if (!file || !roomNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing file or roomNumber' },
        { status: 400 }
      );
    }

    const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ที่อัปโหลดต้องเป็น PDF เท่านั้น' },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ PDF มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 10MB)' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Format: RoomNumber + MM + DD + YYYY (e.g. 10207172026.pdf)
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const fileName = `${roomNumber}${mm}${dd}${yyyy}.pdf`;

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME ?? '',
        Key: fileName,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );

    const pdfUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    
    return NextResponse.json({ success: true, url: pdfUrl });
  } catch (error) {
    console.error('[POST /api/upload-bill] Upload Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload PDF to R2' },
      { status: 502 }
    );
  }
}
