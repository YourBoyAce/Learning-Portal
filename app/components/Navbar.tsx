"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";

export default function Navbar() {
    return (
        <nav className="w-full bg-[#0a0a0f] text-white border-b border-[#1682F1]/20">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

                <div className="flex items-center gap-2">
                    <Logo width={160} height={48} />
                </div>

                <div className="hidden md:flex gap-6 text-sm">
                    <Link href="/dashboard">Dashboard</Link>
                    <Link href="/courses">Courses</Link>
                </div>

                <Link href="/login">
                    <button className="px-4 py-2 bg-[#1682F1] rounded-md hover:bg-[#0050DE] transition-colors">
                        Login
                    </button>
                </Link>

            </div>
        </nav>
    );
}