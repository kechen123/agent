export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthVariables = {
  user: AuthUser;
};
