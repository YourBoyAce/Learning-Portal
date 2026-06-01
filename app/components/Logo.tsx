export function Logo({
  className = "",
  width = 160,
  height = 48,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 350 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Stylized 'A' (Reverted to original paths) */}
      <path
        d="M 50 15 L 85 75 L 61 75 L 50 55 L 39 75 L 15 75 Z"
        fill="#2283FF"
      />
      <circle cx="50" cy="45" r="5" fill="white" />
      
      {/* Text 'Auto-Mate' */}
      <text
        x="100"
        y="60"
        fontFamily="'Futura', 'Tw Cen MT', 'Jost', 'Spartan', sans-serif"
        fontWeight="700"
        fontSize="44"
        fill="#2283FF"
        letterSpacing="-1.5"
      >
        Auto-Mate
      </text>
      
      {/* Subtext 'Lead Next' */}
      <text
        x="213"
        y="82"
        fontFamily="'Futura', 'Tw Cen MT', 'Jost', 'Spartan', sans-serif"
        fontWeight="300"
        fontSize="15"
        fill="#4A9CF8"
        letterSpacing="7"
        textAnchor="middle"
      >
        Lead Next
      </text>
    </svg>
  );
}