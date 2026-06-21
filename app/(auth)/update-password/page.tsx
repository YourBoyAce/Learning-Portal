"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { getPasswordValidationErrors } from "@/lib/password-validation";
import Image from "next/image";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setInitializing(false);
    };

    checkSession();
  }, [router]);

  const handleUpdatePassword = async () => {
    const validationErrors = getPasswordValidationErrors(newPassword);

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        throw passwordError;
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ password_updated: true })
        .eq("id", user.id);

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role?.toLowerCase() === "admin") {
        router.push("/admin");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 py-8 flex flex-col items-center justify-center">
      <div className="text-center mb-4 shrink-0 flex flex-col items-center">
        <Image src="/logo.svg" alt="Auto-Mate" width={160} height={48} className="object-contain" />
      </div>

      <div className="w-full max-w-md mx-auto shrink-0">
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Update your password</h2>
          <p className="text-xs text-gray-500 mt-1 mb-5">
            Create a secure password before continuing to your account.
          </p>

          <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>NEW PASSWORD</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={initializing || loading}
            className="w-full mt-1 bg-[#F0F2F5] border border-gray-200 rounded-md px-3 py-2 text-sm outline-none text-gray-700"
            placeholder="Enter new password"
          />

          <label className={`${TYPOGRAPHY_CLASSES.INNERHEADING} block mt-4`}>
            CONFIRM PASSWORD
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={initializing || loading}
            className="w-full mt-1 bg-[#F0F2F5] border border-gray-200 rounded-md px-3 py-2 text-sm outline-none text-gray-700"
            placeholder="Confirm new password"
          />

          <ul className="mt-4 space-y-1 text-xs text-gray-500">
            <li>Minimum 8 characters</li>
            <li>One uppercase letter</li>
            <li>One lowercase letter</li>
            <li>One number</li>
            <li>One special character</li>
          </ul>

          {error && (
            <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-4">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          <Button
            onClick={handleUpdatePassword}
            disabled={initializing || loading}
            className="w-full mt-6 justify-center"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

