// "use client";

// import { useState, useEffect } from "react";
// import { supabase } from "@/app/lib/supabase";
// import UserAvatar from "@/app/components/UserAvatar";
// import {Button} from "@/components/ui/button";
// import {ICONS} from "@/app/styles/icons";
// import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
// import Image from "next/image";

// export default function ProfilePage() {
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSaving, setIsSaving] = useState(false);

//   const [userId, setUserId] = useState("");
//   const [email, setEmail] = useState("");
//   const [role, setRole] = useState("Scholar Extraordinaire");
//   const [memberSince, setMemberSince] = useState("Loading...");

//   const [fullName, setFullName] = useState("");
//   const [bio, setBio] = useState("");
//   const [portfolioUrl, setPortfolioUrl] = useState("");

//   useEffect(() => {
//     async function loadUserProfile() {
//       try {
//         const {
//           data: { user },
//           error: authError,
//         } = await supabase.auth.getUser();

//         if (authError || !user) {
//           throw new Error("Could not verify user session.");
//         }

//         setUserId(user.id);
//         setEmail(user.email || "");

//         const { data: profile, error: profileError } = await supabase
//           .from("profiles")
//           .select("*")
//           .eq("id", user.id)
//           .single();

//         if (profileError) {
//           console.error(profileError);
//         }

//         if (profile) {
//           setFullName(profile.full_name || "");
//           setBio(profile.bio || "");
//           setPortfolioUrl(profile.portfolio_url || "");

//           if (profile.role) {
//             setRole(profile.role);
//           }

//           if (profile.created_at) {
//             const date = new Date(profile.created_at);

//             const formattedDate = date.toLocaleDateString("en-US", {
//               month: "short",
//               year: "numeric",
//             });

//             setMemberSince(formattedDate);
//           }
//         }
//       } catch (err: unknown) {
//         console.error(
//           err instanceof Error ? err.message : String(err)
//         );
//       } finally {
//         setIsLoading(false);
//       }
//     }

//     loadUserProfile();
//   }, []);

//   const handleSave = async () => {
//     if (!userId) return;

//     setIsSaving(true);

//     try {
//       const { error } = await supabase
//         .from("profiles")
//         .update({
//           full_name: fullName.trim(),
//           bio: bio.trim(),
//           portfolio_url: portfolioUrl.trim(),
//         })
//         .eq("id", userId);

//       if (error) {
//         throw error;
//       }

//       alert("Profile updated successfully.");
//     } catch (err: unknown) {
//       console.error(err);

//       alert("Failed to update profile.");
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="h-screen w-full flex items-center justify-center bg-surface-page">
//         Loading...
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-surface-page p-4 sm:p-8 font-sans">
//       <div className="max-w-[900px] mx-auto">
//         <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
//           My Profile
//         </h1>

//         <p className="text-[13px] text-gray-500 mb-8 max-w-xl leading-relaxed">
//           Customize your digital sanctuary. This information will be visible
//           to your instructors and peers within the Academic Atelier ecosystem.
//         </p>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* LEFT COLUMN */}
//           <div className="space-y-6">
//             {/* PROFILE IDENTITY */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6 flex flex-col items-center">
//               <h3 className="w-full text-left font-bold text-brand-primary text-[16px] mb-6">
//                 Profile Identity
//               </h3>

//               <div className="mb-4">
//                 <UserAvatar
//                   name={fullName}
//                   email={email}
//                   size={140}
//                   textSize="text-4xl"
//                 />
//               </div>


//             </div>

//             {/* ACCOUNT STATUS */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6">
//               <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-5">
//                 ACCOUNT STATUS
//               </h3>

//               <div className="space-y-4">
//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">
//                     Role
//                   </span>

//                   <span className="text-[13px] font-bold text-brand-primary capitalize">
//                     {role}
//                   </span>
//                 </div>

//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">
//                     Member since
//                   </span>

//                   <span className="text-[13px] font-bold text-brand-primary">
//                     {memberSince}
//                   </span>
//                 </div>

//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">
//                     Verification
//                   </span>

//                   <div className="flex items-center gap-1.5">
//                     <svg
//                       className="w-4 h-4 text-[#0052CC]"
//                       viewBox="0 0 20 20"
//                       fill="currentColor"
//                     >
//                       <path
//                         fillRule="evenodd"
//                         d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
//                         clipRule="evenodd"
//                       />
//                     </svg>

//                     <span className="text-[13px] font-bold text-[#0052CC]">
//                       Verified
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* RIGHT COLUMN */}
//           <div className="lg:col-span-2 space-y-6">
//             {/* PERSONAL IDENTITY */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
//               <h3 className="font-bold text-brand-primary text-[18px] mb-6">
//                 Personal Identity
//               </h3>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div>
//                   <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
//                     FULL NAME
//                   </label>

//                   <input
//                     type="text"
//                     value={fullName}
//                     onChange={(e) => setFullName(e.target.value)}
//                     className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors"
//                     placeholder="Alexander Hamilton"
//                   />
//                 </div>

//                 <div>
//                   <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
//                     EMAIL ADDRESS
//                   </label>

//                   <input
//                     type="email"
//                     value={email}
//                     disabled
//                     className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:outline-none cursor-not-allowed"
//                   />
//                 </div>
//               </div>
//             </div>

//             {/* SCHOLARLY BIO */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
//               <h3 className="font-bold text-brand-primary text-[18px] mb-6">
//                 Scholarly Bio
//               </h3>

//               <div>
//                 <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
//                   INTELLECTUAL INTERESTS & GOALS
//                 </label>

//                 <textarea
//                   value={bio}
//                   onChange={(e) => setBio(e.target.value)}
//                   rows={4}
//                   maxLength={500}
//                   className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors resize-none"
//                   placeholder="Dedicated polymath currently exploring..."
//                 />

//                 <div className="text-right mt-2">
//                   <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
//                     {bio.length} / 500 CHARACTERS
//                   </span>
//                 </div>
//               </div>
//             </div>

//             {/* DIGITAL FOOTPRINT */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
//               <h3 className="font-bold text-brand-primary text-[18px] mb-6">
//                 Digital Footprint
//               </h3>

//               <div className="flex items-center bg-surface-subtle rounded-md px-4 py-3.5 border border-transparent focus-within:border-brand-primary/30 focus-within:bg-white transition-colors mb-12">
//                 <svg
//                   className="w-5 h-5 text-gray-400 mr-3"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
//                   />
//                 </svg>

//                 <input
//                   type="text"
//                   value={portfolioUrl}
//                   onChange={(e) => setPortfolioUrl(e.target.value)}
//                   className="w-full bg-transparent border-none text-[13px] text-gray-800 font-medium outline-none"
//                   placeholder="https://portfolio.atelier.edu/a-hamilton"
//                 />
//               </div>

//               <div className="flex flex-col sm:flex-row gap-4 sm:justify-between items-stretch sm:items-center">
//                 <div className="flex items-center gap-2">
//                   <div className="w-5 h-5 bg-[#00E5FF] rounded-full flex items-center justify-center shrink-0">
//                     <svg
//                       className="w-3 h-3 text-white"
//                       fill="currentColor"
//                       viewBox="0 0 20 20"
//                     >
//                       <path
//                         fillRule="evenodd"
//                         d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
//                         clipRule="evenodd"
//                       />
//                     </svg>
//                   </div>

//                   <span className="text-[11px] text-gray-400 font-medium tracking-wide">
//                     Profile updates are saved securely
//                   </span>
//                 </div>

//                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setBio("");
//                       setPortfolioUrl("");
//                     }}
//                     className="text-[13px] text-gray-600 font-semibold hover:text-gray-800 transition text-center sm:text-left"
//                   >
//                     Discard
//                   </button>

//                   <Button
//                     onClick={handleSave}
//                     disabled={isSaving}
//                     className="w-full sm:w-auto justify-center"
//                   >
//                     {isSaving ? "Saving..." : "Commit Changes"}
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import UserAvatar from "@/app/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { dispatchProfileUpdated } from "@/app/lib/profile-events";

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Scholar Extraordinaire");
  const [memberSince, setMemberSince] = useState("Loading...");

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [calEventTypeId, setCalEventTypeId] = useState("");

  // --- New Password State ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Could not verify user session.");
        }

        setUserId(user.id);
        setEmail(user.email || "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(profileError);
        }

        if (profile) {
          setFullName(profile.full_name || "");
          setBio(profile.bio || "");
          setPortfolioUrl(profile.portfolio_url || "");
          setCalEventTypeId(profile.cal_event_type_id ? String(profile.cal_event_type_id) : "");

          if (profile.role) {
            setRole(profile.role);
          }

          if (profile.created_at) {
            const date = new Date(profile.created_at);

            const formattedDate = date.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            });

            setMemberSince(formattedDate);
          }
        }
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, []);

  // --- Existing Profile Save ---
  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);

    try {
      const parsedCalId = calEventTypeId.trim() ? parseInt(calEventTypeId.trim(), 10) : null;
      if (calEventTypeId.trim() && isNaN(Number(calEventTypeId.trim()))) {
        alert("Please enter a valid numeric Event Type ID.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim(),
          portfolio_url: portfolioUrl.trim(),
          cal_event_type_id: parsedCalId,
        })
        .eq("id", userId);

      if (error) throw error;

      dispatchProfileUpdated();

      // Trigger meet generation if Event Type ID was successfully updated
      if (parsedCalId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch("/api/mentor-planner/generate-meet", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          }
        } catch (generateErr) {
          console.error("Error generating meeting links on save:", generateErr);
        }
      }

      alert("Profile updated successfully.");
    } catch (err: unknown) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateStrongPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specials = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    const allChars = uppercase + lowercase + numbers + specials;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    setNewPassword(password);
    setConfirmPassword(password);
    setShowPassword(true);
    setPasswordMessage({ type: "success", text: "Strong password suggested and applied!" });
  };

  // --- New Password Update Handler ---
  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in both password fields." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+~`|}{[\]:;?><,./-=]/.test(newPassword);

    if (newPassword.length < 8 || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters long, with 1 uppercase, 1 lowercase, 1 number, and 1 special character." });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMessage({ type: "", text: "" });

    try {
      // 1. Update Auth Password in Supabase
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) throw authError;

      // 2. Mark password_updated flag as true in the profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ password_updated: true })
        .eq("id", userId);

      if (profileError) {
        console.error("Failed to update password_updated flag in profiles:", profileError);
        // We don't throw here because the actual password WAS changed successfully in auth.
      }

      setPasswordMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      console.error(err);
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-8 font-sans">
      <div className="max-w-[900px] mx-auto">
        <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>My Profile</h1>

        <p className="text-[13px] text-gray-500 mb-8 max-w-xl leading-relaxed">
          Customize your digital sanctuary. This information will be visible to
          your instructors and peers within the Academic Atelier ecosystem.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* PROFILE IDENTITY */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6 flex flex-col items-center">
              <h3 className="w-full text-left font-bold text-brand-primary text-[16px] mb-6">
                Profile Identity
              </h3>

              <div className="mb-4">
                <UserAvatar
                  name={fullName}
                  email={email}
                  size={140}
                  textSize="text-4xl"
                />
              </div>
            </div>

            {/* ACCOUNT STATUS */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6">
              <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-5">
                ACCOUNT STATUS
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Role</span>
                  <span className="text-[13px] font-bold text-brand-primary capitalize">
                    {role}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Member since</span>
                  <span className="text-[13px] font-bold text-brand-primary">
                    {memberSince}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Verification</span>
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-[#0052CC]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-[13px] font-bold text-[#0052CC]">Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* PERSONAL IDENTITY */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
              <h3 className="font-bold text-brand-primary text-[18px] mb-6">
                Personal Identity
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors"
                    placeholder="Alexander Hamilton"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:outline-none cursor-not-allowed opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* SECURITY & AUTHENTICATION (NEW SECTION) */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-brand-primary" />
                <h3 className="font-bold text-brand-primary text-[18px]">
                  Security & Authentication
                </h3>
              </div>

              <div className="mb-6">
                <p className="text-[13px] text-gray-500 mb-2">
                  Update the default password provided by your administrator to secure your account.
                </p>
                <ul className="text-[12px] text-gray-400 list-disc list-inside">
                  <li>At least 8 characters long</li>
                  <li>At least 1 uppercase letter</li>
                  <li>At least 1 lowercase letter</li>
                  <li>At least 1 number</li>
                  <li>At least 1 special character</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      NEW PASSWORD
                    </label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-[10px] text-brand-primary font-bold uppercase tracking-wider hover:underline"
                    >
                      Suggest Password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
                    CONFIRM PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="w-full sm:w-auto">
                  {passwordMessage.text && (
                    <span
                      className={`text-[12px] font-semibold ${passwordMessage.type === "error" ? "text-red-500" : "text-emerald-500"
                        }`}
                    >
                      {passwordMessage.text}
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                  variant="outline"
                  className="w-full sm:w-auto text-[13px]"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </div>

            {/* CAL.COM SETUP (INSTRUCTOR/ADMIN ONLY) */}
            {(role?.toLowerCase() === "instructor" || role?.toLowerCase() === "admin") && (
              <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="font-bold text-brand-primary text-[18px]">
                    Cal.com Integration Settings
                  </h3>
                </div>

                <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
                  Provide your Cal.com Event Type ID to enable automatic Google Meet link generation for accepted student bookings.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
                      CAL.COM EVENT TYPE ID
                    </label>
                    <input
                      type="text"
                      value={calEventTypeId}
                      onChange={(e) => setCalEventTypeId(e.target.value)}
                      className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors"
                      placeholder="e.g. 123456"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                      You can find this ID in the URL of your Cal.com event type page (e.g. cal.com/event-types/<b>123456</b>).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SCHOLARLY BIO */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
              <h3 className="font-bold text-brand-primary text-[18px] mb-6">
                Scholarly Bio
              </h3>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">
                  INTELLECTUAL INTERESTS & GOALS
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-colors resize-none"
                  placeholder="Dedicated polymath currently exploring..."
                />
                <div className="text-right mt-2">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                    {bio.length} / 500 CHARACTERS
                  </span>
                </div>
              </div>
            </div>



            {/* DIGITAL FOOTPRINT & MASTER SAVE */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 sm:p-8">
              <h3 className="font-bold text-brand-primary text-[18px] mb-6">
                Digital Footprint
              </h3>

              <div className="flex items-center bg-surface-subtle rounded-md px-4 py-3.5 border border-transparent focus-within:border-brand-primary/30 focus-within:bg-white transition-colors mb-12">
                <svg
                  className="w-5 h-5 text-gray-400 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <input
                  type="text"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full bg-transparent border-none text-[13px] text-gray-800 font-medium outline-none"
                  placeholder="https://portfolio.atelier.edu/a-hamilton"
                />
              </div>

              {/* MASTER SAVE BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-between items-stretch sm:items-center">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#00E5FF] rounded-full flex items-center justify-center shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium tracking-wide">
                    Profile updates are saved securely
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBio("");
                      setPortfolioUrl("");
                    }}
                    className="text-[13px] text-gray-600 font-semibold hover:text-gray-800 transition text-center sm:text-left px-2"
                  >
                    Discard
                  </button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto justify-center"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Commit Changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}