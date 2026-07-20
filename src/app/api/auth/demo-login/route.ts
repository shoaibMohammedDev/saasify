import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Find the demo user
    const user = await db.user.findUnique({
      where: { email: "demo@acme.com" },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Demo user not found. Run the seed first." },
        { status: 404 }
      );
    }

    // Create a JWT session token using NextAuth's jwt encode
    const token = await encode({
      token: {
        sub: String(user.id),
        userId: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
      },
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("next-auth.session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Demo login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
