import { Role } from "../generated/prisma/client.js";
import {
  NOTIFICATION_GROUPS,
  ROLE_LABELS,
  SOUND_OPTIONS,
} from "./settings.constants.js";

// ─── Profile ────────────────────────────────────────────────

export function serializeProfile(
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: Role;
    bio: string | null;
  },
  opts: { canChangeRole: boolean },
) {
  const [firstFromName, ...rest] = user.name.split(" ");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.image ?? null,
    role: user.role.toLowerCase(),
    roleLabel: ROLE_LABELS[user.role],
    bio: user.bio ?? null,
    canChangeRole: opts.canChangeRole,
  };
}

// ─── Security ───────────────────────────────────────────────

export function serializeSecurity(user: {
  passwordChangedAt: Date | null;
  twoFactorEnabled: boolean;
}) {
  return {
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

// ─── Sessions ───────────────────────────────────────────────

export function serializeSession(
  session: {
    id: string;
    device: string;
    createdAt: Date;
    lastActiveAt: Date;
    tokenHash: string;
  },
  currentTokenHash: string | null,
) {
  return {
    id: session.id,
    device: session.device,
    isCurrent: currentTokenHash !== null && session.tokenHash === currentTokenHash,
    signedInAt: session.createdAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
  };
}

// ─── Login activity ────────────────────────────────────────

export function serializeLoginActivity(row: {
  id: string;
  device: string | null;
  location: string | null;
  ipAddress: string | null;
  outcome: "SUCCESS" | "FAILED" | "LOCKED";
  createdAt: Date;
}) {
  return {
    id: row.id,
    device: row.device ?? "Unknown device",
    location: row.location ?? null,
    ipAddress: row.ipAddress ?? null,
    success: row.outcome === "SUCCESS",
    at: row.createdAt.toISOString(),
  };
}

// ─── Notifications ─────────────────────────────────────────

type PrefRow = { key: string; email: boolean; push: boolean };

export function serializeNotificationSettings(
  settings: {
    quietHoursOn: boolean;
    quietStart: string;
    quietEnd: string;
    sound: string;
  } | null,
  prefs: PrefRow[],
) {
  const prefMap = new Map(prefs.map((p) => [p.key, p]));

  const groups = NOTIFICATION_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    items: g.items.map((item) => {
      const saved = prefMap.get(item.key);
      return {
        key: item.key,
        label: item.label,
        email: saved?.email ?? item.defaults.email,
        push: saved?.push ?? item.defaults.push,
      };
    }),
  }));

  return {
    quietHours: {
      enabled: settings?.quietHoursOn ?? false,
      startTime: settings?.quietStart ?? "22:00",
      endTime: settings?.quietEnd ?? "07:00",
    },
    sound: settings?.sound ?? "chime",
    soundOptions: SOUND_OPTIONS,
    groups,
  };
}

// ─── Team ──────────────────────────────────────────────────

export function serializeTeamMember(
  member: {
    id: string;
    name: string;
    image: string | null;
    email: string;
    role: Role;
    lastLoginAt: Date | null;
    teamStatus: "ACTIVE" | "INVITED" | "SUSPENDED";
  },
  opts: { canManage: boolean },
) {
  return {
    id: member.id,
    fullName: member.name,
    avatar: member.image ?? null,
    email: member.email,
    role: member.role.toLowerCase(),
    roleLabel: ROLE_LABELS[member.role],
    lastActiveAt: member.lastLoginAt?.toISOString() ?? null,
    status: member.teamStatus.toLowerCase() as "active" | "invited" | "suspended",
    canManage: opts.canManage,
  };
}