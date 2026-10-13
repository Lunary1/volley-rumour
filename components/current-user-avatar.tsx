"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CurrentUserAvatarProps {
  imageUrl: string | null;
  name: string | null;
}

export const CurrentUserAvatar = ({
  imageUrl,
  name,
}: CurrentUserAvatarProps) => {
  const initials = name
    ?.split(" ")
    ?.map((word) => word[0])
    ?.join("")
    ?.toUpperCase();

  return (
    <Avatar>
      {imageUrl && <AvatarImage src={imageUrl} alt={initials} />}
      <AvatarFallback>{initials || "?"}</AvatarFallback>
    </Avatar>
  );
};
