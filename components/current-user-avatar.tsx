"use client";

import { useCurrentUserImage } from "@/hooks/use-current-user-image";
import { useCurrentUserName } from "@/hooks/use-current-user-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CurrentUserAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
}

export const CurrentUserAvatar = ({
  imageUrl,
  name,
}: CurrentUserAvatarProps = {}) => {
  const profileImage =
    imageUrl !== undefined ? imageUrl : useCurrentUserImage();
  const userName = name !== undefined ? name : useCurrentUserName();
  const initials = userName
    ?.split(" ")
    ?.map((word) => word[0])
    ?.join("")
    ?.toUpperCase();

  return (
    <Avatar>
      {profileImage && <AvatarImage src={profileImage} alt={initials} />}
      <AvatarFallback>{initials || "?"}</AvatarFallback>
    </Avatar>
  );
};
