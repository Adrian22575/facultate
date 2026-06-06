export const DEMO_USER_ID = "demo-user";

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: "demo@teste-facultate.local",
  app_metadata: {
    provider: "demo"
  },
  user_metadata: {
    full_name: "Utilizator Demo"
  }
};

export function isDemoUser(user) {
  return user?.id === DEMO_USER_ID;
}
