import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

// The Drive/Sheets client and node:crypto both need the Node runtime.
export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
