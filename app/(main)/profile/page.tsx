// "use client";

// import { useState, useEffect} from "react";

// import { supabase } from "@/app/lib/supabase";
// import UserAvatar from "@/app/components/UserAvatar";


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
//         const { data: { user }, error: authError } = await supabase.auth.getUser();
//         if (authError || !user) throw new Error("Could not verify user session.");

//         setUserId(user.id);
//         setEmail(user.email || "");

//         const { data: profile, error: profileError } = await supabase
//           .from("profiles")
//           .select("*")
//           .eq("id", user.id)
//           .single();

//         if (!profileError && profile) {
//           setFullName(profile.full_name || "");
//           setBio(profile.bio || "");
//           if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
//           if (profile.role) setRole(profile.role);
//           if (profile.created_at) {
//             const date = new Date(profile.created_at);
//             const formattedDate = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
//             setMemberSince(formattedDate);
//           }
//         }
//       } catch (err: unknown) {
//         console.error(err instanceof Error ? err.message : String(err));
//       } finally {
//         setIsLoading(false);
//       }
//     }
//     loadUserProfile();
//   }, []);


//   const handleSave = async () => {
//     setIsSaving(true);
//     try {
     
//       }
//       await supabase
//   .from("profiles")
//   .update({
//     full_name: fullName,
//     bio: bio,
//   })
//   .eq("id", userId);

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   if (isLoading) {
//     return <div className="h-screen w-full flex items-center justify-center bg-[#F5F7FA]">Loading...</div>;
//   }

//   return (
//     <div className="min-h-screen bg-[#F5F7FA] p-8 font-sans">
//       <div className="max-w-[900px] mx-auto">
//         <h1 className="text-4xl font-extrabold text-[#2283FF] tracking-tight mb-2">
//           My Profile
//         </h1>
//         <p className="text-[13px] text-gray-500 mb-8 max-w-xl leading-relaxed">
//           Customize your digital sanctuary. This information will be visible to your instructors and peers within the Academic Atelier ecosystem.
//         </p>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* Left Column */}
//           <div className="space-y-6">
// <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6 flex flex-col items-center">
//   <h3 className="w-full text-left font-bold text-[#2283FF] text-[16px] mb-6">
//     Profile Identity
//   </h3>

//   <div className="mb-4">
//     <UserAvatar
//       name={fullName}
//       email={email}
//       size={140}
//       textSize="text-4xl"
//     />
//   </div>

//   <p className="text-center text-[12px] text-gray-500 leading-relaxed max-w-[220px]">
//     Your avatar is automatically generated using your profile name.
//   </p>
// </div>
//             {/* Account Status */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6">
//               <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-5">ACCOUNT STATUS</h3>
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">Role</span>
//                   <span className="text-[13px] font-bold text-[#2283FF] capitalize">{role}</span>
//                 </div>
//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">Member since</span>
//                   <span className="text-[13px] font-bold text-[#2283FF]">{memberSince}</span>
//                 </div>
//                 <div className="flex items-center justify-between">
//                   <span className="text-[13px] text-gray-400 font-medium">Verification</span>
//                   <div className="flex items-center gap-1.5">
//                     <svg className="w-4 h-4 text-[#0052CC]" viewBox="0 0 20 20" fill="currentColor">
//                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
//                     </svg>
//                     <span className="text-[13px] font-bold text-[#0052CC]">Verified</span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//           </div>

//           {/* Right Column */}
//           <div className="lg:col-span-2 space-y-6">

//             {/* Personal Identity */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
//               <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">Personal Identity</h3>
//               <div className="grid grid-cols-2 gap-6">
//                 <div>
//                   <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">FULL NAME</label>
//                   <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-[#2283FF]/30 focus:bg-white focus:outline-none transition-colors" placeholder="Alexander Hamilton" />
//                 </div>
//                 <div>
//                   <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">EMAIL ADDRESS</label>
//                   <input type="email" value={email} disabled className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:outline-none cursor-not-allowed" />
//                 </div>
//               </div>
//             </div>

//             {/* Scholarly Bio */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
//               <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">Scholarly Bio</h3>
//               <div>
//                 <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">INTELLECTUAL INTERESTS & GOALS</label>
//                 <textarea
//                   value={bio}
//                   onChange={(e) => setBio(e.target.value)}
//                   rows={4}
//                   className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-[#2283FF]/30 focus:bg-white focus:outline-none transition-colors resize-none"
//                   placeholder="Dedicated polymath currently exploring..."
//                 />
//                 <div className="text-right mt-2">
//                   <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{bio.length} / 500 CHARACTERS</span>
//                 </div>
//               </div>
//             </div>

//             {/* Digital Footprint */}
//             <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
//               <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">Digital Footprint</h3>

//               <div className="flex items-center bg-[#F8FAFC] rounded-md px-4 py-3.5 border border-transparent focus-within:border-[#2283FF]/30 focus-within:bg-white transition-colors mb-12">
//                 <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
//                 <input type="text" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="w-full bg-transparent border-none text-[13px] text-gray-800 font-medium outline-none" placeholder="https://portfolio.atelier.edu/a-hamilton" />
//               </div>

//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <div className="w-5 h-5 bg-[#00E5FF] rounded-full flex items-center justify-center">
//                     <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
//                   </div>
//                   <span className="text-[11px] text-gray-400 font-medium tracking-wide">Last saved 2 minutes ago</span>
//                 </div>
//                 <div className="flex items-center gap-5">
//                   <button className="text-[13px] text-gray-600 font-semibold hover:text-gray-800 transition">
//                     Discard
//                   </button>
//                   <button onClick={handleSave} disabled={isSaving} className="bg-[#0052CC] hover:bg-[#0047b3] text-white px-6 py-2.5 rounded-md text-[13px] font-semibold transition shadow-sm disabled:opacity-50">
//                     {isSaving ? "Saving..." : "Commit Changes"}
//                   </button>
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
        console.error(
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, []);

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim(),
          portfolio_url: portfolioUrl.trim(),
        })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      alert("Profile updated successfully.");
    } catch (err: unknown) {
      console.error(err);

      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F5F7FA]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-8 font-sans">
      <div className="max-w-[900px] mx-auto">
        <h1 className="text-4xl font-extrabold text-[#2283FF] tracking-tight mb-2">
          My Profile
        </h1>

        <p className="text-[13px] text-gray-500 mb-8 max-w-xl leading-relaxed">
          Customize your digital sanctuary. This information will be visible
          to your instructors and peers within the Academic Atelier ecosystem.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* PROFILE IDENTITY */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6 flex flex-col items-center">
              <h3 className="w-full text-left font-bold text-[#2283FF] text-[16px] mb-6">
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
                  <span className="text-[13px] text-gray-400 font-medium">
                    Role
                  </span>

                  <span className="text-[13px] font-bold text-[#2283FF] capitalize">
                    {role}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">
                    Member since
                  </span>

                  <span className="text-[13px] font-bold text-[#2283FF]">
                    {memberSince}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">
                    Verification
                  </span>

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

                    <span className="text-[13px] font-bold text-[#0052CC]">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* PERSONAL IDENTITY */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">
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
                    className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-[#2283FF]/30 focus:bg-white focus:outline-none transition-colors"
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
                    className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* SCHOLARLY BIO */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">
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
                  className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-[#2283FF]/30 focus:bg-white focus:outline-none transition-colors resize-none"
                  placeholder="Dedicated polymath currently exploring..."
                />

                <div className="text-right mt-2">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                    {bio.length} / 500 CHARACTERS
                  </span>
                </div>
              </div>
            </div>

            {/* DIGITAL FOOTPRINT */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#2283FF] text-[18px] mb-6">
                Digital Footprint
              </h3>

              <div className="flex items-center bg-[#F8FAFC] rounded-md px-4 py-3.5 border border-transparent focus-within:border-[#2283FF]/30 focus-within:bg-white transition-colors mb-12">
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#00E5FF] rounded-full flex items-center justify-center">
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

                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => {
                      setBio("");
                      setPortfolioUrl("");
                    }}
                    className="text-[13px] text-gray-600 font-semibold hover:text-gray-800 transition"
                  >
                    Discard
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#0052CC] hover:bg-[#0047b3] text-white px-6 py-2.5 rounded-md text-[13px] font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Commit Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}