import { useEffect, useState } from 'react'
import { COMPANY_GRADIENTS, getUserAvatarGradient } from '@/lib/utils'

const LS_FIRST  = 'bilansia_user_firstname'
const LS_LAST   = 'bilansia_user_lastname'
const LS_AVATAR = 'bilansia_user_avatar_idx'
const LS_PHOTO  = 'bilansia_user_photo'

export const PROFILE_UPDATED_EVENT = 'bilansia:profile-updated'

/** Dispatch this from anywhere that writes profile data to localStorage */
export function dispatchProfileUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
  }
}

export interface UserProfile {
  firstName:   string
  lastName:    string
  displayName: string          // first + last, or email username fallback
  avatarIdx:   number | null
  photo:       string | null
  grad:        { from: string; to: string }
}

function readProfile(email: string): UserProfile {
  const firstName = localStorage.getItem(LS_FIRST) ?? ''
  const lastName  = localStorage.getItem(LS_LAST)  ?? ''
  const stored    = localStorage.getItem(LS_AVATAR)
  const avatarIdx = stored !== null ? parseInt(stored, 10) : null
  const photo     = localStorage.getItem(LS_PHOTO)

  const autoGrad  = getUserAvatarGradient(email)
  const grad      = avatarIdx !== null ? (COMPANY_GRADIENTS[avatarIdx] ?? autoGrad) : autoGrad

  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : (email ? email.split('@')[0] : 'Korisnik')

  return { firstName, lastName, displayName, avatarIdx, photo, grad }
}

export function useUserProfile(email: string): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(() => ({
    firstName:   '',
    lastName:    '',
    displayName: email ? email.split('@')[0] : 'Korisnik',
    avatarIdx:   null,
    photo:       null,
    grad:        getUserAvatarGradient(email),
  }))

  useEffect(() => {
    // Initial load from localStorage
    setProfile(readProfile(email))

    // Re-read whenever the settings page signals a change
    function onUpdate() {
      setProfile(readProfile(email))
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate)
  }, [email])

  return profile
}
