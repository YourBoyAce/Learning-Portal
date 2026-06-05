// components/Input.tsx
import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, rightElement, className = "", ...props }, ref) => {
        return (
            <div className="w-full flex flex-col mb-4">
                {/* Label Row */}
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {label}
                    </label>
                    {rightElement && <div>{rightElement}</div>}
                </div>

                {/* Input Field */}
                <div className="relative">
                    <input
                        ref={ref}
                        className={`w-full bg-surface-page border ${error ? "border-red-500" : "border-gray-200"
                            } rounded-md px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400 focus:border-[#0B1E6D] focus:ring-1 focus:ring-[#0B1E6D] transition-all ${className}`}
                        {...props}
                    />
                </div>

                {/* Error Message */}
                {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>
        );
    }
);

Input.displayName = "Input";