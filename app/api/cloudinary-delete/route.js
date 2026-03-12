import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// YENİ EKLENEN KISIM: Next.js'in statik export modunda (output: export) 
// API rotalarını tamamen derlemek istememesi için. 'force-dynamic' statik modda hata verdiği için prerender = false kullanıyoruz.
export const prerender = false;

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    const { public_id } = await request.json();
    console.log("📡 API Route: Silme isteği alındı. Public ID:", public_id);
    console.log("⚙️ Cloudinary Config Check:", {
        cloud_name: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: !!process.env.CLOUDINARY_API_KEY,
        api_secret: !!process.env.CLOUDINARY_API_SECRET
    });

    if (!public_id) {
      return NextResponse.json({ error: 'Public ID required' }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(public_id);
    console.log("☁️ Cloudinary Destroy Result:", result);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
