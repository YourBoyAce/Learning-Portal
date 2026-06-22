"use client";

import { Edit2, Trash2 } from "lucide-react";

type CueCardProps = {
    title: string;
    thumbnail?: string;
    isAdmin?: boolean;
    onClick?: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
};

// Fallback image just in case
const PLACEHOLDER_IMAGE =
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop";

export default function CueCard({
    title,
    thumbnail,
    isAdmin,
    onClick,
    onEdit,
    onDelete
}: CueCardProps) {
    return (
        <div
            onClick={onClick}
            className="group relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-[2rem] overflow-hidden cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-2xl transition-all duration-500 border border-gray-300"
        >
            {/* Background Image */}
            <img
                src={thumbnail || PLACEHOLDER_IMAGE}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />

            {/* Dark Filter Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-500 ease-in-out" />

            {/* Admin Actions (Top Left) */}
            {isAdmin && (
                <div className="absolute top-6 left-6 flex gap-2 opacity-0 -translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75 ease-out z-10">
                    <button
                        onClick={onEdit}
                        className="bg-white/90 backdrop-blur-md text-[#2283FF] hover:bg-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="bg-red-500/90 backdrop-blur-md text-white hover:bg-red-600 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Top Right Tag */}
            <div className="absolute top-6 right-6 opacity-0 -translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-100 ease-out z-10">
                <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg">
                    Upcoming
                </span>
            </div>

            {/* Bottom Left Title */}
            <div className="absolute bottom-5 left-5 right-5 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-150 ease-out z-10">
                <h4 className="text-lg md:text-xl lg:text-xl font-bold text-white leading-tight drop-shadow-md line-clamp-2 max-w-[95%]">
                    {title}
                </h4>
            </div>
        </div>
    );
}