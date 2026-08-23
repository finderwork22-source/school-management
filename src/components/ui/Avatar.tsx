interface AvatarProps {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({
  name,
  image,
  size = "md",
}: AvatarProps) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={[
        sizes[size],
        "flex shrink-0 items-center justify-center rounded-full",
        "bg-indigo-50 font-semibold text-indigo-700",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}