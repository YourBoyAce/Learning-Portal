"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ui/ThemeToggle";

export default function Navbar() {
    return (
        <nav className="w-full bg-neutral-soft-black text-white border-b border-brand-primary/20">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

                <div className="flex items-center gap-2">
                    <Logo width={160} height={48} />
                </div>

                <div className="hidden md:flex gap-6 text-sm">
                    <Link href="/dashboard">Dashboard</Link>
                    <Link href="/courses">Courses</Link>
                </div>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/login">
                        <button className="px-4 py-2 bg-brand-primary rounded-md hover:bg-brand-hover transition-colors">
                            Login
                        </button>
                    </Link>
                </div>

            </div>
        </nav>
    );
}