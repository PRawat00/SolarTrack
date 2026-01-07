'use client'

export function ChristmasLights() {
  // Colors matching the image: red, green, orange, blue, white
  const bulbColors = [
    { color: '#ff4444', glow: '#ff4444' },  // red
    { color: '#44ff44', glow: '#44ff44' },  // green
    { color: '#ffaa00', glow: '#ffaa00' },  // orange
    { color: '#4444ff', glow: '#4444ff' },  // blue
    { color: '#ffffff', glow: '#ffffff' },  // white
  ]

  // Generate enough bulbs to cover wide screens
  const bulbCount = 20
  const bulbs = Array.from({ length: bulbCount }, (_, i) => bulbColors[i % bulbColors.length])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none overflow-hidden h-16">
      {/* Wire */}
      <svg
        className="absolute top-0 left-0 w-full h-12"
        viewBox="0 0 1000 50"
        preserveAspectRatio="none"
      >
        <path
          d="M0,5 Q25,20 50,5 T100,5 T150,5 T200,5 T250,5 T300,5 T350,5 T400,5 T450,5 T500,5 T550,5 T600,5 T650,5 T700,5 T750,5 T800,5 T850,5 T900,5 T950,5 T1000,5"
          fill="none"
          stroke="#556b2f"
          strokeWidth="2"
        />
      </svg>

      {/* Bulbs */}
      <div className="flex justify-around items-start pt-2 px-4">
        {bulbs.map((bulb, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{
              animation: `twinkle ${1.5 + (i % 5) * 0.3}s ease-in-out infinite`,
              animationDelay: `${(i * 0.2) % 2}s`,
            }}
          >
            {/* Socket */}
            <div className="w-2 h-2 bg-[#556b2f] rounded-sm" />
            {/* Bulb */}
            <div
              className="w-3 h-5 rounded-full mt-0.5"
              style={{
                backgroundColor: bulb.color,
                boxShadow: `0 0 10px 3px ${bulb.glow}, 0 0 20px 6px ${bulb.glow}40`,
              }}
            />
          </div>
        ))}
      </div>

      {/* @ts-expect-error - styled-jsx syntax */}
      <style jsx>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}
