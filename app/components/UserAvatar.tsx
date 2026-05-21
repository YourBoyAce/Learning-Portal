"use client";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  size?: number;
  textSize?: string;
}

export default function UserAvatar({
  name,
  email,
  size = 40,
  textSize = "text-sm",
}: UserAvatarProps) {
  const displayName =
    name?.trim() ||
    email?.split("@")[0] ||
    "User";

  const initials = displayName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const colors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];

  const colorIndex =
    displayName.charCodeAt(0) % colors.length;

  return (
    <div
      className={`
        ${colors[colorIndex]}
        rounded-full
        flex
        items-center
        justify-center
        text-white
        font-semibold
        select-none
        shrink-0
      `}
      style={{
        width: size,
        height: size,
      }}
    >
      <span className={textSize}>
        {initials}
      </span>
    </div>
  );
}