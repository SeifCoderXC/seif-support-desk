export const staff = {
  alex: {
    id: "ag_alex",
    email: "agent@support-console.local",
    name: "Seif",
  },
  mina: {
    id: "ag_mina",
    email: "mina@support-console.local",
    name: "Mina Kovacs",
  },
} as const;

export const staffList = Object.values(staff);
