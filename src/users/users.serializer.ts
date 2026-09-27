type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AddressRow = {
  id: string;
  fullName: string;
  address: string;
  region: string;
  phone: string;
  phone_sec: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeUserProfile(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    avatarUrl: u.image ?? null,
    role: u.role,
    emailVerified: u.emailVerified?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export function serializeAddress(a: AddressRow) {
  return {
    id: a.id,
    fullName: a.fullName,
    address: a.address,
    region: a.region,
    phone: a.phone,
    phone_sec: a.phone_sec ?? undefined,
    isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}